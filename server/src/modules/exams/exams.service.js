import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { buildUpdateSet, placeholders, round, withBooleans, withNumbers } from '../../utils/sql.js';
import { canTeacherAccessClass, teacherCoversSubject } from '../academics/access.service.js';
import {
  computeOverall, describeScale, gradeFor, loadGradingScales, percentageOf, scaleForLevel,
} from './grading.js';

export const EXAM_TYPES = ['quiz', 'monthly_test', 'midterm', 'terminal', 'annual', 'mock'];
export const EXAM_STATUSES = ['draft', 'open', 'closed', 'published'];

/** draft → open (marks entry) → closed (locked) → published (visible to parents). */
const EXAM_TRANSITIONS = {
  draft: ['open'],
  open: ['closed', 'draft'],
  closed: ['open', 'published'],
  published: ['closed'],
};

const EXAM_SELECT = `SELECT e.id, e.name, e.exam_type AS examType, e.term_id AS termId, t.term_name AS termName,
    t.term_number AS termNumber, e.academic_year_id AS academicYearId, ay.year_label AS yearLabel,
    e.start_date AS startDate, e.end_date AS endDate, e.max_score AS maxScore, e.status,
    e.created_by AS createdBy, u.full_name AS createdByName, e.created_at AS createdAt,
    (SELECT COUNT(*) FROM marks m WHERE m.exam_id = e.id) AS marksCount
  FROM exams e
  JOIN terms t ON t.id = e.term_id
  JOIN academic_years ay ON ay.id = e.academic_year_id
  JOIN users u ON u.id = e.created_by`;

const EXAM_COLUMNS = {
  name: 'name',
  examType: 'exam_type',
  termId: 'term_id',
  academicYearId: 'academic_year_id',
  startDate: 'start_date',
  endDate: 'end_date',
  maxScore: 'max_score',
  status: 'status',
};

function visibleStatusesFor(user) {
  if (user.role === 'admin') return EXAM_STATUSES;
  if (user.role === 'parent') return ['published'];
  return ['open', 'closed', 'published'];
}

export async function findExam(id, user) {
  const row = await queryOne(`${EXAM_SELECT} WHERE e.id = ?`, [id]);
  if (!row || (user && !visibleStatusesFor(user).includes(row.status))) throw ApiError.notFound('Exam not found');
  return withNumbers(row, ['maxScore']);
}

export async function listExams({ termId, academicYearId, status }, user) {
  const allowed = visibleStatusesFor(user);
  const where = [`e.status IN (${placeholders(allowed.length)})`];
  const params = [...allowed];
  if (termId) {
    where.push('e.term_id = ?');
    params.push(termId);
  }
  if (academicYearId) {
    where.push('e.academic_year_id = ?');
    params.push(academicYearId);
  }
  if (status) {
    where.push('e.status = ?');
    params.push(status);
  }
  const rows = await query(
    `${EXAM_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY ay.start_date DESC, t.term_number DESC, e.start_date DESC, e.id DESC`,
    params,
  );
  return withNumbers(rows, ['maxScore']);
}

async function resolveTerm(termId) {
  const term = await queryOne(
    'SELECT id, academic_year_id AS academicYearId, start_date AS startDate, end_date AS endDate FROM terms WHERE id = ?',
    [termId],
  );
  if (!term) throw ApiError.badRequest('Please correct the highlighted fields', { termId: 'Term not found' });
  return term;
}

function assertExamDates({ startDate, endDate }, term) {
  const errors = {};
  if (startDate && endDate && endDate < startDate) errors.endDate = 'End date must be on or after the start date';
  if (startDate && (startDate < term.startDate || startDate > term.endDate)) errors.startDate = 'Must fall within the term dates';
  if (endDate && (endDate < term.startDate || endDate > term.endDate)) errors.endDate = 'Must fall within the term dates';
  if (Object.keys(errors).length > 0) throw ApiError.badRequest('Please correct the highlighted fields', errors);
}

export async function createExam(data, user, context) {
  const term = await resolveTerm(data.termId);
  assertExamDates(data, term);
  let result;
  try {
    result = await query(
      `INSERT INTO exams (name, exam_type, term_id, academic_year_id, start_date, end_date, max_score, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [data.name, data.examType, term.id, term.academicYearId, data.startDate ?? null, data.endDate ?? null,
        data.maxScore ?? 100, user.id],
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An exam with this name and type already exists for the term');
    throw error;
  }
  await recordAudit({ ...context, action: 'exam.create', targetTable: 'exams', targetId: result.insertId, details: data });
  return findExam(result.insertId);
}

export async function updateExam(id, data, context) {
  const before = await findExam(id);
  const changes = { ...data };

  if (changes.status !== undefined && changes.status !== before.status) {
    const allowed = EXAM_TRANSITIONS[before.status];
    if (!allowed.includes(changes.status)) {
      throw ApiError.badRequest(`An exam that is ${before.status} can only move to: ${allowed.join(', ')}`);
    }
    if (changes.status === 'draft' && before.marksCount > 0) {
      throw ApiError.conflict('Marks have already been entered; close the exam instead of returning it to draft');
    }
  }

  const hasMarks = before.marksCount > 0;
  if (hasMarks && changes.maxScore !== undefined && changes.maxScore !== before.maxScore) {
    throw ApiError.conflict('The maximum score cannot change after marks have been entered');
  }
  if (hasMarks && changes.termId !== undefined && changes.termId !== before.termId) {
    throw ApiError.conflict('The term cannot change after marks have been entered');
  }

  const term = await resolveTerm(changes.termId ?? before.termId);
  if (changes.termId !== undefined) changes.academicYearId = term.academicYearId;
  assertExamDates({
    startDate: changes.startDate !== undefined ? changes.startDate : before.startDate,
    endDate: changes.endDate !== undefined ? changes.endDate : before.endDate,
  }, term);

  const { sets, params } = buildUpdateSet(changes, EXAM_COLUMNS);
  try {
    await query(`UPDATE exams SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An exam with this name and type already exists for the term');
    throw error;
  }
  await recordAudit({
    ...context,
    action: changes.status && changes.status !== before.status ? `exam.status_${changes.status}` : 'exam.update',
    targetTable: 'exams',
    targetId: id,
    details: { before, changes },
  });
  return findExam(id);
}

export async function deleteExam(id, context) {
  const before = await findExam(id);
  if (before.marksCount > 0) throw ApiError.conflict('This exam already has marks and cannot be deleted');
  await query('DELETE FROM exams WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'exam.delete', targetTable: 'exams', targetId: id, details: before });
}

/** Validate a class/stream/subject target for marks and enforce teacher assignment rules. */
async function resolveMarksTarget(exam, { classId, streamId, subjectId }, user) {
  const [cls, subject] = await Promise.all([
    queryOne('SELECT id, class_name AS className, level FROM classes WHERE id = ?', [classId]),
    queryOne('SELECT id, name, code, level FROM subjects WHERE id = ?', [subjectId]),
  ]);
  if (!cls) throw ApiError.notFound('Class not found');
  if (!subject) throw ApiError.notFound('Subject not found');
  if (subject.level !== cls.level) throw ApiError.badRequest('This subject is not offered at the selected class level');

  let stream = null;
  if (streamId) {
    stream = await queryOne('SELECT id, stream_name AS streamName FROM streams WHERE id = ? AND class_id = ?', [streamId, classId]);
    if (!stream) throw ApiError.badRequest('Stream does not belong to the selected class');
  }

  if (user.role === 'teacher') {
    const covers = await teacherCoversSubject(user.id, {
      subjectId, classId, streamId, academicYearId: exam.academicYearId,
    });
    if (!covers) throw ApiError.forbidden('You are not assigned to teach this subject for the selected class/stream');
  }
  return { cls, subject, stream };
}

export async function getMarksheet(examId, target, user) {
  const exam = await findExam(examId, user);
  const { cls, subject, stream } = await resolveMarksTarget(exam, target, user);
  const streamFilterNow = target.streamId ? 'AND s.stream_id = ?' : '';
  const streamFilterMarks = target.streamId ? 'AND stream_id = ?' : '';
  const params = [examId, target.subjectId, target.classId];
  if (target.streamId) params.push(target.streamId);
  params.push(examId, target.subjectId, target.classId);
  if (target.streamId) params.push(target.streamId);

  const rows = await query(
    `SELECT s.id AS studentId, s.registration_number AS registrationNumber, s.first_name AS firstName,
            s.middle_name AS middleName, s.last_name AS lastName, s.gender, s.status,
            COALESCE(m.stream_id, s.stream_id) AS streamId, st.stream_name AS streamName,
            m.score, m.is_absent AS isAbsent, m.remarks, m.updated_at AS markUpdatedAt
       FROM students s
       LEFT JOIN marks m ON m.student_id = s.id AND m.exam_id = ? AND m.subject_id = ?
       LEFT JOIN streams st ON st.id = COALESCE(m.stream_id, s.stream_id)
      WHERE (s.class_id = ? AND s.status = 'active' ${streamFilterNow})
         OR s.id IN (SELECT student_id FROM marks WHERE exam_id = ? AND subject_id = ? AND class_id = ? ${streamFilterMarks})
      ORDER BY s.first_name, s.middle_name, s.last_name`,
    params,
  );

  const scale = scaleForLevel(await loadGradingScales(), cls.level);
  const students = withBooleans(withNumbers(rows, ['score']), ['isAbsent']).map((row) => {
    const percentage = row.isAbsent ? null : percentageOf(row.score, exam.maxScore);
    const band = gradeFor(scale, percentage);
    return {
      ...row,
      fullName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
      percentage,
      grade: band?.grade ?? null,
    };
  });

  return {
    exam,
    class: cls,
    stream,
    subject,
    canEdit: exam.status === 'open',
    gradingScale: describeScale(scale),
    students,
  };
}

export async function saveBulkMarks(data, user, context) {
  const exam = await findExam(data.examId, user);
  if (exam.status !== 'open') throw ApiError.conflict('Marks can only be entered while the exam is open');
  const { cls } = await resolveMarksTarget(exam, data, user);

  const scoreErrors = {};
  data.entries.forEach((entry, index) => {
    if (!entry.isAbsent && entry.score !== null && entry.score > exam.maxScore) {
      scoreErrors[`entries.${index}.score`] = `Must not exceed the exam maximum of ${exam.maxScore}`;
    }
  });
  if (Object.keys(scoreErrors).length > 0) throw ApiError.badRequest('Some scores are out of range', scoreErrors);

  const studentIds = data.entries.map((entry) => entry.studentId);
  const students = await query(
    `SELECT id, class_id AS classId, stream_id AS streamId, status FROM students WHERE id IN (${placeholders(studentIds.length)})`,
    studentIds,
  );
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const outcome = await withTransaction(async (connection) => {
    const existingRows = withBooleans(withNumbers(await query(
      `SELECT id, student_id AS studentId, score, is_absent AS isAbsent, remarks, class_id AS classId, stream_id AS streamId
         FROM marks
        WHERE exam_id = ? AND subject_id = ? AND student_id IN (${placeholders(studentIds.length)})
        FOR UPDATE`,
      [exam.id, data.subjectId, ...studentIds],
      connection,
    ), ['score']), ['isAbsent']);
    const existing = new Map(existingRows.map((row) => [row.studentId, row]));

    const ineligible = [];
    for (const entry of data.entries) {
      const student = studentMap.get(entry.studentId);
      const prior = existing.get(entry.studentId);
      const inClassNow = student && student.status === 'active' && student.classId === data.classId
        && (!data.streamId || student.streamId === data.streamId);
      const priorInScope = prior && prior.classId === data.classId && (!data.streamId || prior.streamId === data.streamId);
      if ((prior && prior.classId !== data.classId) || (!inClassNow && !priorInScope)) ineligible.push(entry.studentId);
    }
    if (ineligible.length > 0) {
      throw ApiError.badRequest('Some students do not belong to the selected class/stream', { studentIds: ineligible });
    }

    const changes = [];
    let inserted = 0;
    let updated = 0;
    let cleared = 0;

    for (const entry of data.entries) {
      const prior = existing.get(entry.studentId);
      const student = studentMap.get(entry.studentId);
      const remarks = entry.remarks !== undefined ? entry.remarks : (prior?.remarks ?? null);
      const isAbsent = Boolean(entry.isAbsent);
      const score = isAbsent ? null : entry.score;

      if (!isAbsent && score === null) {
        if (prior) {
          await query('DELETE FROM marks WHERE id = ?', [prior.id], connection);
          changes.push({ studentId: entry.studentId, before: { score: prior.score, isAbsent: prior.isAbsent }, after: null });
          cleared += 1;
        }
        continue;
      }

      if (prior) {
        if (prior.score === score && prior.isAbsent === isAbsent && (prior.remarks ?? null) === remarks) continue;
        await query(
          'UPDATE marks SET score = ?, is_absent = ?, remarks = ?, updated_by = ? WHERE id = ?',
          [score, Number(isAbsent), remarks, user.id, prior.id],
          connection,
        );
        changes.push({
          studentId: entry.studentId,
          before: { score: prior.score, isAbsent: prior.isAbsent, remarks: prior.remarks },
          after: { score, isAbsent, remarks },
        });
        updated += 1;
      } else {
        const streamId = student && student.classId === data.classId ? student.streamId : null;
        await query(
          `INSERT INTO marks (exam_id, student_id, subject_id, class_id, stream_id, score, is_absent, remarks, entered_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [exam.id, entry.studentId, data.subjectId, data.classId, streamId, score, Number(isAbsent), remarks, user.id],
          connection,
        );
        changes.push({ studentId: entry.studentId, before: null, after: { score, isAbsent, remarks } });
        inserted += 1;
      }
    }

    if (changes.length > 0) {
      await recordAudit({
        ...context,
        action: 'marks.bulk_save',
        targetTable: 'marks',
        targetId: exam.id,
        details: { examId: exam.id, subjectId: data.subjectId, classId: data.classId, streamId: data.streamId ?? null, changes },
      }, connection);
    }
    return { inserted, updated, cleared, unchanged: data.entries.length - changes.length };
  });

  const results = await computeClassResults(exam, cls.id, { streamId: data.streamId ?? null });
  return { ...outcome, subjectSummary: results.statistics.subjects.find((s) => s.subjectId === data.subjectId) ?? null, results };
}

/**
 * Full results for one exam and class: per-subject grades, totals, averages, division/grade,
 * remarks, and class + stream positions computed with RANK() window functions.
 * Positions are always class-wide; `streamId` only filters the returned rows.
 */
export async function computeClassResults(examOrId, classId, { streamId = null } = {}) {
  const exam = typeof examOrId === 'object' ? examOrId : await findExam(examOrId);
  const cls = await queryOne(
    `SELECT c.id, c.class_name AS className, c.level, c.class_teacher_id AS classTeacherId, u.full_name AS classTeacherName
       FROM classes c LEFT JOIN users u ON u.id = c.class_teacher_id WHERE c.id = ?`,
    [classId],
  );
  if (!cls) throw ApiError.notFound('Class not found');
  const scale = scaleForLevel(await loadGradingScales(), cls.level);

  const rankRows = withNumbers(await query(
    `SELECT ranked.*
       FROM (
         SELECT ps.studentId, ps.subjectsSat, ps.totalScore, ps.averagePct,
                RANK() OVER (ORDER BY ps.averagePct DESC, ps.totalScore DESC) AS classPosition,
                COUNT(*) OVER () AS classSize,
                RANK() OVER (PARTITION BY ps.streamId ORDER BY ps.averagePct DESC, ps.totalScore DESC) AS streamPosition,
                COUNT(*) OVER (PARTITION BY ps.streamId) AS streamSize
           FROM (
             SELECT m.student_id AS studentId, MAX(m.stream_id) AS streamId, COUNT(*) AS subjectsSat,
                    SUM(m.score) AS totalScore, ROUND(AVG(m.score / e.max_score * 100), 2) AS averagePct
               FROM marks m
               JOIN exams e ON e.id = m.exam_id
              WHERE m.exam_id = ? AND m.class_id = ? AND m.is_absent = 0
              GROUP BY m.student_id
           ) ps
       ) ranked`,
    [exam.id, classId],
  ), ['totalScore', 'averagePct']);
  const ranks = new Map(rankRows.map((row) => [row.studentId, row]));

  const markRows = withBooleans(withNumbers(await query(
    `SELECT m.student_id AS studentId, m.subject_id AS subjectId, m.score, m.is_absent AS isAbsent, m.remarks,
            m.stream_id AS streamId, st.stream_name AS streamName,
            sub.name AS subjectName, sub.code AS subjectCode, sub.is_core AS isCore,
            s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
            s.last_name AS lastName, s.gender
       FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       JOIN students s ON s.id = m.student_id
       LEFT JOIN streams st ON st.id = m.stream_id
      WHERE m.exam_id = ? AND m.class_id = ?
      ORDER BY sub.is_core DESC, sub.name`,
    [exam.id, classId],
  ), ['score']), ['isAbsent', 'isCore']);

  const subjects = new Map();
  const students = new Map();
  for (const row of markRows) {
    if (!subjects.has(row.subjectId)) {
      subjects.set(row.subjectId, { subjectId: row.subjectId, code: row.subjectCode, name: row.subjectName, isCore: row.isCore });
    }
    if (!students.has(row.studentId)) {
      students.set(row.studentId, {
        studentId: row.studentId,
        registrationNumber: row.registrationNumber,
        fullName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
        gender: row.gender,
        streamId: row.streamId,
        streamName: row.streamName,
        subjects: [],
      });
    }
    const percentage = row.isAbsent ? null : percentageOf(row.score, exam.maxScore);
    const band = gradeFor(scale, percentage);
    students.get(row.studentId).subjects.push({
      subjectId: row.subjectId,
      code: row.subjectCode,
      name: row.subjectName,
      score: row.score,
      isAbsent: row.isAbsent,
      percentage,
      grade: row.isAbsent ? 'ABS' : band?.grade ?? null,
      points: row.isAbsent ? null : band?.points ?? null,
      remark: row.isAbsent ? 'Absent' : band?.remark ?? null,
      teacherRemark: row.remarks,
    });
  }

  let results = [...students.values()].map((student) => {
    const rank = ranks.get(student.studentId);
    const sat = student.subjects.filter((subject) => !subject.isAbsent);
    const averagePct = rank ? rank.averagePct : null;
    return {
      ...student,
      subjectsSat: rank ? rank.subjectsSat : 0,
      totalScore: rank ? rank.totalScore : 0,
      maxPossible: round(sat.length * exam.maxScore, 2),
      averagePct,
      overall: computeOverall(cls.level, scale, sat, averagePct),
      classPosition: rank ? rank.classPosition : null,
      classSize: rankRows.length,
      streamPosition: rank ? rank.streamPosition : null,
      streamSize: rank ? rank.streamSize : null,
    };
  });

  if (streamId) results = results.filter((student) => student.streamId === streamId);
  results.sort((a, b) => (a.classPosition ?? Infinity) - (b.classPosition ?? Infinity) || a.fullName.localeCompare(b.fullName));

  return {
    exam,
    class: cls,
    streamId,
    gradingScale: describeScale(scale),
    subjects: [...subjects.values()],
    students: results,
    statistics: buildStatistics(results, [...subjects.values()]),
  };
}

function buildStatistics(results, subjects) {
  const ranked = results.filter((student) => student.averagePct !== null);
  const passed = ranked.filter((student) => student.overall.passed).length;
  const overallDistribution = {};
  for (const student of ranked) {
    overallDistribution[student.overall.value] = (overallDistribution[student.overall.value] || 0) + 1;
  }

  const subjectStats = subjects.map((subject) => {
    const entries = results
      .map((student) => student.subjects.find((s) => s.subjectId === subject.subjectId))
      .filter((entry) => entry && !entry.isAbsent);
    const percentages = entries.map((entry) => entry.percentage);
    const gradeDistribution = {};
    for (const entry of entries) gradeDistribution[entry.grade] = (gradeDistribution[entry.grade] || 0) + 1;
    return {
      ...subject,
      candidates: entries.length,
      meanPct: percentages.length ? round(percentages.reduce((a, b) => a + b, 0) / percentages.length, 2) : null,
      highestPct: percentages.length ? Math.max(...percentages) : null,
      lowestPct: percentages.length ? Math.min(...percentages) : null,
      gradeDistribution,
    };
  });

  return {
    candidates: results.length,
    ranked: ranked.length,
    meanAverage: ranked.length ? round(ranked.reduce((sum, s) => sum + s.averagePct, 0) / ranked.length, 2) : null,
    passRate: ranked.length ? round((passed / ranked.length) * 100, 1) : null,
    passed,
    overallDistribution,
    subjects: subjectStats,
  };
}

export async function getResults(examId, { classId, streamId }, user) {
  const exam = await findExam(examId, user);
  if (user.role === 'teacher') {
    const allowed = await canTeacherAccessClass(user.id, classId, exam.academicYearId);
    if (!allowed) throw ApiError.forbidden('You do not teach this class');
  }
  return computeClassResults(exam, classId, { streamId });
}
