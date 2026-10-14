import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { canTeacherAccessClass, isClassTeacher } from '../academics/access.service.js';
import { computeClassResults, findExam } from '../exams/exams.service.js';
import { getSchoolProfile } from '../system/settings.service.js';

async function findStudentBasic(studentId) {
  const student = await queryOne(
    `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
            s.last_name AS lastName, s.gender, s.dob, s.parent_name AS parentName, s.parent_user_id AS parentUserId
       FROM students s WHERE s.id = ?`,
    [studentId],
  );
  if (!student) throw ApiError.notFound('Student not found');
  return { ...student, fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') };
}

/** The class/stream the student was in when the exam marks were recorded. */
async function findExamPlacement(examId, studentId) {
  const placement = await queryOne(
    `SELECT m.class_id AS classId, MAX(m.stream_id) AS streamId, COUNT(*) AS entries
       FROM marks m
      WHERE m.exam_id = ? AND m.student_id = ?
      GROUP BY m.class_id
      ORDER BY entries DESC
      LIMIT 1`,
    [examId, studentId],
  );
  if (!placement) throw ApiError.notFound('No marks have been recorded for this student in the selected exam');
  const names = await queryOne(
    `SELECT c.class_name AS className, st.stream_name AS streamName
       FROM classes c LEFT JOIN streams st ON st.id = ?
      WHERE c.id = ?`,
    [placement.streamId ?? 0, placement.classId],
  );
  return { classId: placement.classId, streamId: placement.streamId, ...names };
}

async function assertReportAccess(user, student, classId, exam) {
  if (user.role === 'admin') return;
  if (user.role === 'parent') {
    if (student.parentUserId !== user.id) throw ApiError.notFound('Student not found');
    return;
  }
  if (user.role === 'teacher' && await canTeacherAccessClass(user.id, classId, exam.academicYearId)) return;
  throw ApiError.forbidden('You do not have access to this report card');
}

async function subjectTeachers(classId, streamId, academicYearId) {
  const rows = await query(
    `SELECT ta.subject_id AS subjectId, ta.stream_id AS streamId, u.full_name AS teacherName
       FROM teacher_assignments ta
       JOIN users u ON u.id = ta.teacher_id
      WHERE ta.class_id = ? AND ta.academic_year_id = ? AND (ta.stream_id IS NULL OR ta.stream_id = ?)`,
    [classId, academicYearId, streamId ?? 0],
  );
  const map = new Map();
  // Stream-specific assignments take precedence over class-wide ones.
  for (const row of rows.sort((a, b) => (a.streamId ? 1 : 0) - (b.streamId ? 1 : 0))) map.set(row.subjectId, row.teacherName);
  return map;
}

async function remarksFor(examId, studentIds) {
  if (studentIds.length === 0) return new Map();
  const rows = await query(
    `SELECT student_id AS studentId, class_teacher_remark AS classTeacherRemark, headmaster_remark AS headmasterRemark
       FROM report_remarks WHERE exam_id = ? AND student_id IN (${studentIds.map(() => '?').join(', ')})`,
    [examId, ...studentIds],
  );
  return new Map(rows.map((row) => [row.studentId, row]));
}

function assembleCard({ exam, results, student, placement, teachers, remarks, user, school }) {
  const result = results.students.find((entry) => entry.studentId === student.id) ?? null;
  if (result) {
    result.subjects = result.subjects.map((subject) => ({ ...subject, teacherName: teachers.get(subject.subjectId) ?? null }));
  }
  return {
    school,
    exam: {
      id: exam.id,
      name: exam.name,
      examType: exam.examType,
      termName: exam.termName,
      yearLabel: exam.yearLabel,
      maxScore: exam.maxScore,
      status: exam.status,
    },
    student: {
      id: student.id,
      registrationNumber: student.registrationNumber,
      fullName: student.fullName,
      gender: student.gender,
      dob: student.dob,
      parentName: student.parentName,
      classId: placement.classId,
      className: placement.className,
      streamName: placement.streamName,
    },
    level: results.class.level,
    result,
    classTeacherName: results.class.classTeacherName,
    gradingScale: results.gradingScale,
    remarks: {
      classTeacherRemark: remarks?.classTeacherRemark ?? null,
      headmasterRemark: remarks?.headmasterRemark ?? null,
    },
    permissions: {
      editClassTeacherRemark: user.role === 'admin' || (user.role === 'teacher' && results.class.classTeacherId === user.id),
      editHeadmasterRemark: user.role === 'admin',
    },
  };
}

export async function getReportCardData(studentId, examId, user) {
  const exam = await findExam(examId, user);
  if (exam.status === 'draft') throw ApiError.conflict('Report cards are not available for draft exams');
  const student = await findStudentBasic(studentId);
  const placement = await findExamPlacement(exam.id, student.id);
  await assertReportAccess(user, student, placement.classId, exam);

  const [results, teachers, remarks, school] = await Promise.all([
    computeClassResults(exam, placement.classId),
    subjectTeachers(placement.classId, placement.streamId, exam.academicYearId),
    remarksFor(exam.id, [student.id]),
    getSchoolProfile(),
  ]);
  return assembleCard({ exam, results, student, placement, teachers, remarks: remarks.get(student.id), user, school });
}

/** Every report card for a class (optionally one stream), in class-position order. */
export async function getClassReportCards(examId, classId, streamId, user) {
  const exam = await findExam(examId, user);
  if (exam.status === 'draft') throw ApiError.conflict('Report cards are not available for draft exams');
  if (user.role === 'teacher' && !(await canTeacherAccessClass(user.id, classId, exam.academicYearId))) {
    throw ApiError.forbidden('You do not have access to this class');
  }

  const results = await computeClassResults(exam, classId, { streamId });
  if (results.students.length === 0) throw ApiError.notFound('No marks have been recorded for this class in the selected exam');

  const studentIds = results.students.map((entry) => entry.studentId);
  const [teachersByStream, remarks, students, school] = await Promise.all([
    Promise.all([...new Set(results.students.map((entry) => entry.streamId ?? null))].map(async (sid) => [
      sid, await subjectTeachers(classId, sid, exam.academicYearId),
    ])).then((pairs) => new Map(pairs)),
    remarksFor(exam.id, studentIds),
    query(
      `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
              s.last_name AS lastName, s.gender, s.dob, s.parent_name AS parentName, s.parent_user_id AS parentUserId
         FROM students s WHERE s.id IN (${studentIds.map(() => '?').join(', ')})`,
      studentIds,
    ),
    getSchoolProfile(),
  ]);
  const studentMap = new Map(students.map((s) => [s.id, {
    ...s, fullName: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '),
  }]));

  return {
    exam,
    className: results.class.className,
    cards: results.students.map((entry) => assembleCard({
      exam,
      results,
      student: studentMap.get(entry.studentId),
      placement: { classId, className: results.class.className, streamName: entry.streamName, streamId: entry.streamId },
      teachers: teachersByStream.get(entry.streamId ?? null),
      remarks: remarks.get(entry.studentId),
      user,
      school,
    })),
  };
}

/** Exams with recorded marks for a student that the current user may view. */
export async function listAvailableReports(studentId, user) {
  const student = await findStudentBasic(studentId);
  if (user.role === 'parent' && student.parentUserId !== user.id) throw ApiError.notFound('Student not found');

  const statuses = user.role === 'parent' ? ['published'] : ['open', 'closed', 'published'];
  const rows = await query(
    `SELECT e.id AS examId, e.name, e.exam_type AS examType, e.status, t.term_name AS termName,
            ay.year_label AS yearLabel, MAX(m.class_id) AS classId
       FROM marks m
       JOIN exams e ON e.id = m.exam_id
       JOIN terms t ON t.id = e.term_id
       JOIN academic_years ay ON ay.id = e.academic_year_id
      WHERE m.student_id = ? AND e.status IN (${statuses.map(() => '?').join(', ')})
      GROUP BY e.id, e.name, e.exam_type, e.status, t.term_name, ay.year_label, ay.start_date, t.term_number
      ORDER BY ay.start_date DESC, t.term_number DESC, e.id DESC`,
    [studentId, ...statuses],
  );

  if (user.role !== 'teacher') return rows;
  const visible = [];
  for (const row of rows) {
    const exam = await findExam(row.examId);
    if (await canTeacherAccessClass(user.id, row.classId, exam.academicYearId)) visible.push(row);
  }
  return visible;
}

export async function saveRemarks(data, user, context) {
  const exam = await findExam(data.examId, user);
  if (exam.status === 'draft') throw ApiError.conflict('Remarks cannot be added to a draft exam');
  const student = await findStudentBasic(data.studentId);
  const placement = await findExamPlacement(exam.id, student.id);

  if (user.role === 'teacher') {
    if (data.headmasterRemark !== undefined) throw ApiError.forbidden('Only the Headmaster can write the headmaster remarks');
    if (!(await isClassTeacher(user.id, placement.classId))) {
      throw ApiError.forbidden('Only the class teacher can write class teacher remarks');
    }
  }

  const existing = await queryOne(
    `SELECT id, class_teacher_remark AS classTeacherRemark, headmaster_remark AS headmasterRemark
       FROM report_remarks WHERE exam_id = ? AND student_id = ?`,
    [exam.id, student.id],
  );
  const next = {
    classTeacherRemark: data.classTeacherRemark !== undefined ? data.classTeacherRemark : existing?.classTeacherRemark ?? null,
    headmasterRemark: data.headmasterRemark !== undefined ? data.headmasterRemark : existing?.headmasterRemark ?? null,
  };

  if (existing) {
    await query(
      'UPDATE report_remarks SET class_teacher_remark = ?, headmaster_remark = ?, updated_by = ? WHERE id = ?',
      [next.classTeacherRemark, next.headmasterRemark, user.id, existing.id],
    );
  } else {
    await query(
      `INSERT INTO report_remarks (exam_id, student_id, class_teacher_remark, headmaster_remark, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [exam.id, student.id, next.classTeacherRemark, next.headmasterRemark, user.id],
    );
  }
  await recordAudit({
    ...context,
    action: 'report_remarks.save',
    targetTable: 'report_remarks',
    targetId: student.id,
    details: { examId: exam.id, studentId: student.id, before: existing ?? null, after: next },
  });
  return next;
}
