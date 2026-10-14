import { query, queryOne } from '../../config/db.js';

/**
 * Teacher data-scope rules shared by the students, exams and reports modules.
 * A teacher may see a class when they are its class teacher or hold any subject
 * assignment in it for the relevant academic year.
 */

export async function isClassTeacher(userId, classId, executor) {
  const row = await queryOne('SELECT 1 AS ok FROM classes WHERE id = ? AND class_teacher_id = ?', [classId, userId], executor);
  return Boolean(row);
}

export async function teacherClassIds(userId, academicYearId) {
  const rows = await query(
    `SELECT class_id AS classId FROM teacher_assignments WHERE teacher_id = ? AND academic_year_id = ?
     UNION
     SELECT id AS classId FROM classes WHERE class_teacher_id = ?`,
    [userId, academicYearId ?? 0, userId],
  );
  return rows.map((row) => row.classId);
}

export async function canTeacherAccessClass(userId, classId, academicYearId) {
  const row = await queryOne(
    `SELECT 1 AS ok FROM classes WHERE id = ? AND class_teacher_id = ?
     UNION
     SELECT 1 AS ok FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND academic_year_id = ?
     LIMIT 1`,
    [classId, userId, userId, classId, academicYearId ?? 0],
  );
  return Boolean(row);
}

/**
 * True when the teacher is assigned the subject for the requested class/stream.
 * A class-wide assignment (stream NULL) covers every stream; a whole-class request
 * (streamId null) requires a class-wide assignment.
 */
export async function teacherCoversSubject(userId, { subjectId, classId, streamId, academicYearId }) {
  const row = await queryOne(
    `SELECT 1 AS ok FROM teacher_assignments
      WHERE teacher_id = ? AND subject_id = ? AND class_id = ? AND academic_year_id = ?
        AND (stream_id IS NULL OR stream_id = ?)
      LIMIT 1`,
    [userId, subjectId, classId, academicYearId, streamId ?? 0],
  );
  return Boolean(row);
}
