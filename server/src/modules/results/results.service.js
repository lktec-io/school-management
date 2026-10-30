import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { placeholders, withBooleans, withNumbers } from '../../utils/sql.js';
import { canTeacherAccessClass } from '../academics/access.service.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { findExam, listExams } from '../exams/exams.service.js';
import { sendResultNotifications } from '../sms/sms.service.js';
import { getSchoolProfile } from '../system/settings.service.js';

/**
 * Bulk results upload: one spreadsheet row per student and exam, one column per subject.
 * Rows are all-or-nothing (a bad cell fails that student's row, never a partial record); valid rows are
 * saved in one transaction. Blank subject cells leave existing marks untouched; ABS records an absence.
 */

export const MAX_RESULT_ROWS = 500;
const MAX_CELL_LENGTH = 255;

/** Fixed columns, matched loosely (case, spaces, punctuation; English or Swahili). */
const FIXED_COLUMNS = {
  registrationNumber: ['registrationnumber', 'regnumber', 'regno', 'registrationno', 'nambayausajili'],
  studentName: ['studentname', 'name', 'student', 'jinalamwanafunzi', 'jina'],
  term: ['term', 'muhula'],
  examType: ['examtype', 'exam', 'mtihani', 'ainayamtihani'],
  remarks: ['remarks', 'remark', 'comment', 'comments', 'maoni'],
};
/** Columns staff often keep from their own mark sheets; they carry nothing to save. */
const IGNORED_COLUMNS = new Set(['sn', 'no', 'class', 'darasa', 'stream', 'mkondo', 'total', 'jumla', 'average', 'avg', 'wastani', 'position', 'nafasi', 'grade', 'division']);

const EXAM_TYPE_NAMES = { quiz: 'Quiz', monthly_test: 'Monthly Test', midterm: 'Mid-Term', terminal: 'Terminal', annual: 'Annual', mock: 'Mock' };
const EXAM_TYPE_ALIASES = {
  quiz: 'quiz',
  monthlytest: 'monthly_test',
  monthly: 'monthly_test',
  midterm: 'midterm',
  nusumuhula: 'midterm',
  terminal: 'terminal',
  mwishowamuhula: 'terminal',
  annual: 'annual',
  mwaka: 'annual',
  mock: 'mock',
};
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4 };
const ABSENT = new Set(['ABS', 'ABSENT', 'AB']);

const key = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const regKey = (value) => clean(value).toUpperCase().replace(/\s+/g, '');
const fullName = (row) => [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ');

/** Map header cells to fixed columns and subject columns. Unknown headers reject the file: marks must never vanish silently. */
function mapHeaders(headerRow, subjects, { hasDefaultExam }) {
  const fixed = {};
  const subjectColumns = [];
  const unknown = [];
  headerRow.forEach((cell, index) => {
    const header = clean(cell);
    const name = key(header);
    if (!name || IGNORED_COLUMNS.has(name)) return;
    const fixedKey = Object.keys(FIXED_COLUMNS).find((column) => FIXED_COLUMNS[column].includes(name));
    if (fixedKey) {
      fixed[fixedKey] ??= index;
      return;
    }
    const matches = subjects.filter((subject) => key(subject.code) === name || key(subject.name) === name);
    if (matches.length === 0) unknown.push(header);
    else if (subjectColumns.some((column) => column.key === name)) throw ApiError.badRequest(`The subject column "${header}" appears twice.`, { file: 'Duplicate column' });
    else subjectColumns.push({ index, header, key: name, subjects: matches });
  });

  if (fixed.registrationNumber === undefined) {
    throw ApiError.badRequest('The file has no RegistrationNumber column. Download the template and copy your data into it.', { file: 'Missing columns' });
  }
  if (!hasDefaultExam && (fixed.term === undefined || fixed.examType === undefined)) {
    throw ApiError.badRequest('The file needs Term and ExamType columns. Download the template and copy your data into it.', { file: 'Missing columns' });
  }
  if (unknown.length) {
    throw ApiError.badRequest(`No subject matches these columns: ${unknown.join(', ')}. Use the subject name or code exactly as in Academic Setup. Nothing was saved.`, { file: 'Unknown columns' });
  }
  if (subjectColumns.length === 0) throw ApiError.badRequest('The file has no subject columns.', { file: 'Missing columns' });
  return { fixed, subjectColumns };
}

async function loadSubjects() {
  return query('SELECT id, name, code, level FROM subjects WHERE is_active = 1 ORDER BY display_order, is_core DESC, name');
}

async function loadTerms() {
  return query(
    `SELECT t.id, t.term_name AS termName, t.term_number AS termNumber, t.academic_year_id AS academicYearId, ay.year_label AS yearLabel
       FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id`,
  );
}

/** "Term I", "Term I 2026", "2026 Term 1", "Muhula II", "2" → one term of the named (or current) academic year. */
function findTerm(cell, terms, currentYearId) {
  const text = clean(cell);
  const year = text.match(/\b(20\d{2})\b/)?.[1];
  const label = key(text.replace(/\b20\d{2}\b/, ''));
  const bare = label.replace(/^(term|muhula)/, '');
  const number = ROMAN[bare] ?? (/^\d$/.test(bare) ? Number(bare) : null);
  const inYear = terms.filter((term) => (year ? String(term.yearLabel).includes(year) : term.academicYearId === currentYearId));
  return inYear.find((term) => key(term.termName) === label || (number !== null && term.termNumber === number)) ?? null;
}

function examResolver({ exams, terms, currentYearId, defaultExam }) {
  const cache = new Map();
  const resolve = (termCell, typeCell) => {
    if (!clean(termCell) && !clean(typeCell) && defaultExam) return { exam: defaultExam };
    if (!clean(termCell)) return { error: 'Term is required' };
    if (!clean(typeCell)) return { error: 'ExamType is required' };
    const term = findTerm(termCell, terms, currentYearId);
    if (!term) return { error: `Term "${clean(termCell)}" not found${/\b20\d{2}\b/.test(termCell) ? '' : ' in the current academic year'}` };

    const inTerm = exams.filter((exam) => exam.termId === term.id);
    const typed = key(typeCell);
    const byName = inTerm.filter((exam) => key(exam.name) === typed);
    const type = EXAM_TYPE_ALIASES[typed];
    const candidates = byName.length ? byName : inTerm.filter((exam) => exam.examType === type);
    const where = `${term.termName} ${term.yearLabel}`;
    if (candidates.length === 0) {
      return { error: type ? `No ${EXAM_TYPE_NAMES[type]} exam exists for ${where}` : `Exam type "${clean(typeCell)}" not recognised (use Mid-Term, Terminal, Annual, Monthly Test, Quiz or Mock)` };
    }
    if (candidates.length > 1) {
      return { error: `${where} has ${candidates.length} ${EXAM_TYPE_NAMES[type]} exams (${candidates.map((exam) => exam.name).join(', ')}). Put the exact exam name in ExamType` };
    }
    return { exam: candidates[0] };
  };
  return (termCell, typeCell) => {
    const cacheKey = `${clean(termCell)}|${clean(typeCell)}`;
    if (!cache.has(cacheKey)) cache.set(cacheKey, resolve(termCell, typeCell));
    return cache.get(cacheKey);
  };
}

async function loadStudentsByRegNo(regNumbers) {
  if (regNumbers.length === 0) return new Map();
  const rows = await query(
    `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
            s.last_name AS lastName, s.status, s.class_id AS classId, s.stream_id AS streamId,
            c.class_name AS className, c.level
       FROM students s JOIN classes c ON c.id = s.class_id
      WHERE s.registration_number IN (${placeholders(regNumbers.length)})`,
    regNumbers,
  );
  return new Map(rows.map((row) => [regKey(row.registrationNumber), row]));
}

async function loadExistingMarks(studentIds, examIds, connection) {
  if (studentIds.length === 0 || examIds.length === 0) return new Map();
  const rows = withBooleans(withNumbers(await query(
    `SELECT id, exam_id AS examId, student_id AS studentId, subject_id AS subjectId, score, is_absent AS isAbsent,
            remarks, class_id AS classId
       FROM marks
      WHERE exam_id IN (${placeholders(examIds.length)}) AND student_id IN (${placeholders(studentIds.length)})
      ${connection ? 'FOR UPDATE' : ''}`,
    [...examIds, ...studentIds],
    connection,
  ), ['score']), ['isAbsent']);
  return new Map(rows.map((row) => [`${row.examId}|${row.studentId}|${row.subjectId}`, row]));
}

/** At least one name in the file must appear in the record, so a mistyped number cannot hand marks to another child. */
function namesAgree(typed, student) {
  const record = new Set(fullName(student).toLowerCase().split(/\s+/));
  return clean(typed).toLowerCase().split(/\s+/).some((part) => record.has(part));
}

function parseMark(cell, header, maxScore) {
  const text = clean(cell).replace(',', '.');
  if (ABSENT.has(text.toUpperCase())) return { isAbsent: true, score: null };
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { error: `${header} — Invalid marks format ("${clean(cell).slice(0, 20)}")` };
  const score = Number(text);
  if (score < 0 || score > maxScore) return { error: `${header} — ${text} is outside the valid range 0-${maxScore}` };
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return { error: `${header} — Use at most 2 decimal places ("${text}")` };
  return { isAbsent: false, score };
}

const marksDiffer = (prior, mark, remarks) => prior.score !== mark.score || prior.isAbsent !== mark.isAbsent || (prior.remarks ?? null) !== remarks;

/** Validate every row against the database. Returns the rows to save plus a report of the rest. */
async function analyseTable(table, user, { defaultExamId }) {
  if (!Array.isArray(table) || table.length < 2) throw ApiError.badRequest('The file has no result rows below the header row.', { file: 'No data rows' });
  if (table.length - 1 > MAX_RESULT_ROWS) {
    throw ApiError.badRequest(`Upload at most ${MAX_RESULT_ROWS} rows at a time (this file has ${table.length - 1}). Split the file and upload each part.`, { file: 'Too many rows' });
  }

  const defaultExam = defaultExamId ? await findExam(defaultExamId, user) : null;
  const subjects = await loadSubjects();
  const { fixed, subjectColumns } = mapHeaders(table[0], subjects, { hasDefaultExam: Boolean(defaultExam) });
  const [exams, terms, period, assignments] = await Promise.all([
    listExams({}, user),
    loadTerms(),
    getCurrentPeriod(),
    user.role === 'teacher'
      ? query('SELECT subject_id AS subjectId, class_id AS classId, stream_id AS streamId, academic_year_id AS academicYearId FROM teacher_assignments WHERE teacher_id = ?', [user.id])
      : Promise.resolve(null),
  ]);
  const resolveExam = examResolver({ exams, terms, currentYearId: period.academicYear?.id ?? null, defaultExam });

  const cell = (cells, column) => (column === undefined ? '' : clean(cells[column]).slice(0, MAX_CELL_LENGTH));
  const dataRows = table.slice(1).map((cells, offset) => ({ cells, line: offset + 2 })).filter(({ cells }) => cells.some((value) => clean(value) !== ''));
  if (dataRows.length === 0) throw ApiError.badRequest('The file has no result rows below the header row.', { file: 'No data rows' });

  const students = await loadStudentsByRegNo([...new Set(dataRows.map(({ cells }) => cell(cells, fixed.registrationNumber)).filter(Boolean))]);
  const existing = await loadExistingMarks([...students.values()].map((student) => student.id), exams.map((exam) => exam.id));
  const studentsWithMarks = new Set([...existing.values()].map((mark) => `${mark.examId}|${mark.studentId}`));

  const teaches = (subjectId, student, exam) => assignments.some((row) => row.subjectId === subjectId && row.classId === student.classId
    && row.academicYearId === exam.academicYearId && (row.streamId === null || row.streamId === student.streamId));

  const seen = new Map();
  const ready = [];
  const failed = [];
  const skipped = [];

  for (const { cells, line } of dataRows) {
    const registrationNumber = cell(cells, fixed.registrationNumber);
    const typedName = cell(cells, fixed.studentName);
    const reasons = [];
    const student = registrationNumber ? students.get(regKey(registrationNumber)) : null;
    const { exam, error: examError } = resolveExam(cell(cells, fixed.term), cell(cells, fixed.examType));
    const remarksText = fixed.remarks === undefined ? '' : clean(cells[fixed.remarks]);

    if (!registrationNumber) reasons.push('RegistrationNumber is required');
    else if (!student) reasons.push(`Student registration number ${registrationNumber} not found`);
    if (examError) reasons.push(examError);
    if (remarksText.length > MAX_CELL_LENGTH) reasons.push(`Remarks must be ${MAX_CELL_LENGTH} characters or fewer`);
    if (student && typedName && !namesAgree(typedName, student)) {
      reasons.push(`Name "${typedName}" does not match ${student.registrationNumber} (${fullName(student)})`);
    }

    const marks = [];
    if (student && exam) {
      if (exam.status !== 'open') reasons.push(`${exam.name} is ${exam.status}: marks can only be uploaded while the exam is open`);
      const duplicateOf = seen.get(`${exam.id}|${student.id}`);
      if (duplicateOf) reasons.push(`Same student and exam as row ${duplicateOf}`);
      else seen.set(`${exam.id}|${student.id}`, line);

      if (student.status !== 'active' && !studentsWithMarks.has(`${exam.id}|${student.id}`)) reasons.push(`Student is ${student.status}, not active`);

      for (const column of subjectColumns) {
        const raw = cell(cells, column.index);
        if (!raw) continue;
        const subject = column.subjects.find((candidate) => candidate.level === student.level);
        if (!subject) {
          reasons.push(`${column.header} — Not offered in ${student.className}`);
          continue;
        }
        if (assignments && !teaches(subject.id, student, exam)) {
          reasons.push(`${column.header} — You are not assigned to teach this subject in ${student.className}`);
          continue;
        }
        const prior = existing.get(`${exam.id}|${student.id}|${subject.id}`);
        if (prior && prior.classId !== student.classId) {
          reasons.push(`${column.header} — A mark for this exam is already recorded under another class`);
          continue;
        }
        const mark = parseMark(raw, column.header, exam.maxScore);
        if (mark.error) reasons.push(mark.error);
        else marks.push({ subjectId: subject.id, subjectName: column.header, isAbsent: mark.isAbsent, score: mark.score, prior: prior ?? null });
      }
    }

    const studentName = student ? fullName(student) : typedName || null;
    if (reasons.length) {
      failed.push({ line, registrationNumber: registrationNumber || null, name: studentName, reasons, message: `Row ${line}: ${reasons.join('; ')}` });
    } else if (marks.length === 0) {
      skipped.push({ line, registrationNumber, name: studentName, message: `Row ${line}: No marks entered for ${studentName}` });
    } else {
      const remarks = remarksText || null;
      const changed = marks.filter((mark) => !mark.prior || marksDiffer(mark.prior, mark, remarks ?? mark.prior.remarks ?? null));
      ready.push({
        line,
        student,
        exam,
        remarks,
        marks,
        status: changed.length === 0 ? 'unchanged' : changed.some((mark) => mark.prior) ? 'update' : 'new',
      });
    }
  }
  return { total: dataRows.length, ready, failed, skipped };
}

const rowSummary = (row) => ({
  line: row.line,
  registrationNumber: row.student.registrationNumber,
  name: fullName(row.student),
  className: row.student.className,
  exam: row.exam.name,
  subjects: row.marks.length,
  status: row.status,
  marks: row.marks.map(({ subjectName, score, isAbsent }) => ({ subject: subjectName, score, isAbsent })),
});

/** Check a file without saving: every row is reported as it would be on upload. */
export async function previewResults(table, user, options) {
  const { total, ready, failed, skipped } = await analyseTable(table, user, options);
  return {
    dryRun: true,
    total,
    valid: ready.length,
    failedCount: failed.length,
    skippedCount: skipped.length,
    toWrite: ready.filter((row) => row.status !== 'unchanged').length,
    overwrites: ready.filter((row) => row.status === 'update').length,
    rows: ready.map(rowSummary),
    failed,
    skipped,
  };
}

/**
 * Save the valid rows in one transaction, then optionally text parents of the students whose marks changed.
 * The SMS step runs after the commit: a gateway problem is reported but never undoes saved marks.
 */
export async function importResults(table, user, context, { fileName, sendSms = false, ...options }) {
  const { total, ready, failed, skipped } = await analyseTable(table, user, options);
  const counts = { inserted: 0, updated: 0, unchanged: 0 };
  const overwritten = [];
  const changedRows = [];

  if (ready.length > 0) {
    await withTransaction(async (connection) => {
      const studentIds = [...new Set(ready.map((row) => row.student.id))];
      const examIds = [...new Set(ready.map((row) => row.exam.id))];
      const current = await loadExistingMarks(studentIds, examIds, connection);

      for (const row of ready) {
        let rowChanged = false;
        for (const mark of row.marks) {
          const prior = current.get(`${row.exam.id}|${row.student.id}|${mark.subjectId}`);
          const remarks = row.remarks ?? prior?.remarks ?? null;
          if (!prior) {
            await query(
              `INSERT INTO marks (exam_id, student_id, subject_id, class_id, stream_id, score, is_absent, remarks, entered_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [row.exam.id, row.student.id, mark.subjectId, row.student.classId, row.student.streamId, mark.score, Number(mark.isAbsent), remarks, user.id],
              connection,
            );
            counts.inserted += 1;
            rowChanged = true;
          } else if (marksDiffer(prior, mark, remarks)) {
            await query(
              'UPDATE marks SET score = ?, is_absent = ?, remarks = ?, updated_by = ? WHERE id = ?',
              [mark.score, Number(mark.isAbsent), remarks, user.id, prior.id],
              connection,
            );
            overwritten.push({
              studentId: row.student.id,
              examId: row.exam.id,
              subjectId: mark.subjectId,
              before: { score: prior.score, isAbsent: prior.isAbsent },
              after: { score: mark.score, isAbsent: mark.isAbsent },
            });
            counts.updated += 1;
            rowChanged = true;
          } else {
            counts.unchanged += 1;
          }
        }
        if (rowChanged) changedRows.push(row);
      }

      await recordAudit({
        ...context,
        action: 'results.import',
        targetTable: 'marks',
        details: {
          fileName,
          uploadedBy: user.id,
          sendSms,
          total,
          saved: changedRows.length,
          failed: failed.length,
          skipped: skipped.length,
          marks: counts,
          exams: examIds,
          overwritten,
        },
      }, connection);
    });
  }

  let sms = { requested: sendSms, sent: false };
  if (sendSms) {
    try {
      sms = { requested: true, ...(await sendResultNotifications(changedRows.map((row) => ({ exam: row.exam, student: row.student })), user, context)) };
    } catch (error) {
      sms = { requested: true, sent: false, error: error.message };
    }
  }

  return {
    dryRun: false,
    total,
    saved: changedRows.length,
    unchanged: ready.length - changedRows.length,
    failedCount: failed.length,
    skippedCount: skipped.length,
    marks: counts,
    rows: ready.map(rowSummary),
    failed,
    skipped,
    sms,
  };
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const BOM = String.fromCharCode(0xfeff);

/**
 * Results template. With examId/classId (and streamId) it is ready to fill in: the class roster with Term and
 * ExamType completed and that level's subjects. Otherwise headers only, with every active subject. It has no
 * sample row on purpose: a sample registration number could belong to a real student.
 */
export async function resultsTemplate({ examId, classId, streamId }, user) {
  const school = await getSchoolProfile();
  const slug = String(school.name ?? 'school').split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'school';
  const exam = examId ? await findExam(examId, user) : null;
  let subjects = await loadSubjects();
  let roster = [];

  if (classId) {
    const [cls] = await query('SELECT id, level FROM classes WHERE id = ?', [classId]);
    if (!cls) throw ApiError.notFound('Class not found');
    subjects = subjects.filter((subject) => subject.level === cls.level);
    if (user.role === 'teacher') {
      const yearId = exam?.academicYearId ?? (await getCurrentPeriod()).academicYear?.id;
      if (!(await canTeacherAccessClass(user.id, classId, yearId))) throw ApiError.forbidden('You do not teach this class');
      const taught = await query('SELECT DISTINCT subject_id AS subjectId FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND academic_year_id = ?', [user.id, classId, yearId]);
      const ids = new Set(taught.map((row) => row.subjectId));
      subjects = subjects.filter((subject) => ids.has(subject.id));
    }
    const params = [classId];
    if (streamId) params.push(streamId);
    roster = await query(
      `SELECT s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName
         FROM students s
        WHERE s.class_id = ? AND s.status = 'active' ${streamId ? 'AND s.stream_id = ?' : ''}
        ORDER BY s.first_name, s.middle_name, s.last_name`,
      params,
    );
  }

  // The same subject name can exist at several levels; one column serves them all.
  const columns = [...new Map(subjects.map((subject) => [key(subject.name), subject.name])).values()];
  const header = ['RegistrationNumber', 'StudentName', 'Term', 'ExamType', ...columns, 'Remarks'];
  let examLabel = '';
  if (exam) {
    const sameType = (await listExams({ termId: exam.termId }, user)).filter((item) => item.examType === exam.examType);
    examLabel = sameType.length > 1 ? exam.name : EXAM_TYPE_NAMES[exam.examType];
  }
  const term = exam ? `${exam.termName} ${exam.yearLabel}` : '';
  const lines = [
    header.map(csvCell).join(','),
    ...roster.map((student) => [student.registrationNumber, fullName(student), term, examLabel, ...columns.map(() => ''), ''].map(csvCell).join(',')),
  ];
  return { filename: `${slug}_results_template.csv`, content: `${BOM}${lines.join('\r\n')}\r\n` };
}
