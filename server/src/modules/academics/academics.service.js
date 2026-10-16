import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { buildUpdateSet, rethrowDuplicate, withBooleans } from '../../utils/sql.js';
import { getCurrentPeriod } from './calendar.service.js';

const LEVEL_ORDER = "FIELD(c.level, 'nursery', 'primary', 'o_level', 'a_level')";

const CLASS_COLUMNS = {
  className: 'class_name',
  code: 'code',
  level: 'level',
  sortOrder: 'sort_order',
  classTeacherId: 'class_teacher_id',
  isActive: 'is_active',
};
const STREAM_COLUMNS = { streamName: 'stream_name', code: 'code', capacity: 'capacity', displayOrder: 'display_order', isActive: 'is_active' };
const SUBJECT_COLUMNS = { name: 'name', code: 'code', level: 'level', displayOrder: 'display_order', isCore: 'is_core', isActive: 'is_active' };

async function assertActiveTeacher(userId, field = 'teacherId') {
  const user = await queryOne('SELECT role, status FROM users WHERE id = ?', [userId]);
  if (!user || user.role !== 'teacher' || user.status !== 'active') {
    throw ApiError.badRequest('Please correct the highlighted fields', { [field]: 'Must be an active teacher account' });
  }
}

// ---------------------------------------------------------------------------
// Classes & streams
// ---------------------------------------------------------------------------

const CLASS_SELECT = `SELECT c.id, c.class_name AS className, c.code, c.level, c.sort_order AS sortOrder,
    c.is_active AS isActive, c.class_teacher_id AS classTeacherId, u.full_name AS classTeacherName,
    (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'active') AS activeStudents
  FROM classes c
  LEFT JOIN users u ON u.id = c.class_teacher_id`;

const STREAM_SELECT = `SELECT st.id, st.class_id AS classId, st.stream_name AS streamName, st.code, st.capacity,
    st.display_order AS displayOrder, st.is_active AS isActive,
    (SELECT COUNT(*) FROM students s WHERE s.stream_id = st.id AND s.status = 'active') AS activeStudents
  FROM streams st`;

async function findClass(id) {
  const row = await queryOne(`${CLASS_SELECT} WHERE c.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Class not found');
  const streams = await query(`${STREAM_SELECT} WHERE st.class_id = ? ORDER BY st.display_order, st.stream_name`, [id]);
  return { ...withBooleans(row, ['isActive']), streams: withBooleans(streams, ['isActive']) };
}

async function findStream(id) {
  const row = await queryOne(`${STREAM_SELECT} WHERE st.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Stream not found');
  return withBooleans(row, ['isActive']);
}

export async function listClasses({ includeInactive = false } = {}) {
  const classes = withBooleans(
    await query(`${CLASS_SELECT} ${includeInactive ? '' : 'WHERE c.is_active = 1'} ORDER BY ${LEVEL_ORDER}, c.sort_order, c.class_name`),
    ['isActive'],
  );
  const streams = withBooleans(
    await query(`${STREAM_SELECT} ${includeInactive ? '' : 'WHERE st.is_active = 1'} ORDER BY st.display_order, st.stream_name`),
    ['isActive'],
  );
  return classes.map((cls) => ({ ...cls, streams: streams.filter((stream) => stream.classId === cls.id) }));
}

export async function createClass(data, context) {
  if (data.classTeacherId) await assertActiveTeacher(data.classTeacherId, 'classTeacherId');
  let result;
  try {
    result = await query(
      `INSERT INTO classes (class_name, code, level, sort_order, class_teacher_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.className, data.code, data.level, data.sortOrder ?? 0, data.classTeacherId ?? null, Number(data.isActive ?? true)],
    );
  } catch (error) {
    rethrowDuplicate(error, 'A class with this name or code already exists');
  }
  await recordAudit({ ...context, action: 'class.create', targetTable: 'classes', targetId: result.insertId, details: data });
  return findClass(result.insertId);
}

export async function updateClass(id, data, context) {
  const before = await findClass(id);
  if (data.classTeacherId) await assertActiveTeacher(data.classTeacherId, 'classTeacherId');
  const { sets, params } = buildUpdateSet(data, CLASS_COLUMNS);
  try {
    await query(`UPDATE classes SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, 'A class with this name or code already exists');
  }
  const { streams, ...snapshot } = before;
  await recordAudit({ ...context, action: 'class.update', targetTable: 'classes', targetId: id, details: { before: snapshot, changes: data } });
  return findClass(id);
}

export async function deleteClass(id, context) {
  const before = await findClass(id);
  if (before.streams.length > 0) throw ApiError.conflict('Remove the streams of this class before deleting it');
  await query('DELETE FROM classes WHERE id = ?', [id]);
  const { streams, ...snapshot } = before;
  await recordAudit({ ...context, action: 'class.delete', targetTable: 'classes', targetId: id, details: snapshot });
}

export async function createStream(data, context) {
  await findClass(data.classId);
  let result;
  try {
    result = await query(
      'INSERT INTO streams (class_id, stream_name, code, capacity, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [data.classId, data.streamName, data.code, data.capacity ?? null, data.displayOrder ?? 0, Number(data.isActive ?? true)],
    );
  } catch (error) {
    rethrowDuplicate(error, 'This class already has a stream with that name, or the code is in use');
  }
  await recordAudit({ ...context, action: 'stream.create', targetTable: 'streams', targetId: result.insertId, details: data });
  return findStream(result.insertId);
}

export async function updateStream(id, data, context) {
  const before = await findStream(id);
  if (data.capacity !== undefined && data.capacity !== null && data.capacity < before.activeStudents) {
    throw ApiError.badRequest('Please correct the highlighted fields', {
      capacity: `Stream already has ${before.activeStudents} active students`,
    });
  }
  const { sets, params } = buildUpdateSet(data, STREAM_COLUMNS);
  try {
    await query(`UPDATE streams SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, 'This class already has a stream with that name, or the code is in use');
  }
  await recordAudit({ ...context, action: 'stream.update', targetTable: 'streams', targetId: id, details: { before, changes: data } });
  return findStream(id);
}

export async function deleteStream(id, context) {
  const before = await findStream(id);
  await query('DELETE FROM streams WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'stream.delete', targetTable: 'streams', targetId: id, details: before });
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

const SUBJECT_SELECT = `SELECT sub.id, sub.name, sub.code, sub.level, sub.display_order AS displayOrder, sub.is_core AS isCore, sub.is_active AS isActive
  FROM subjects sub`;

async function findSubject(id) {
  const row = await queryOne(`${SUBJECT_SELECT} WHERE sub.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Subject not found');
  return withBooleans(row, ['isCore', 'isActive']);
}

export async function listSubjects({ level, includeInactive = false } = {}) {
  const where = [];
  const params = [];
  if (level) {
    where.push('sub.level = ?');
    params.push(level);
  }
  if (!includeInactive) where.push('sub.is_active = 1');
  const rows = await query(
    `${SUBJECT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY FIELD(sub.level, 'nursery', 'primary', 'o_level', 'a_level'), sub.display_order, sub.is_core DESC, sub.name`,
    params,
  );
  return withBooleans(rows, ['isCore', 'isActive']);
}

export async function createSubject(data, context) {
  let result;
  try {
    result = await query(
      'INSERT INTO subjects (name, code, level, display_order, is_core, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [data.name, data.code, data.level, data.displayOrder ?? 0, Number(data.isCore ?? true), Number(data.isActive ?? true)],
    );
  } catch (error) {
    rethrowDuplicate(error, 'A subject with this code, or this name at the same level, already exists');
  }
  await recordAudit({ ...context, action: 'subject.create', targetTable: 'subjects', targetId: result.insertId, details: data });
  return findSubject(result.insertId);
}

export async function updateSubject(id, data, context) {
  const before = await findSubject(id);
  const { sets, params } = buildUpdateSet(data, SUBJECT_COLUMNS);
  try {
    await query(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, 'A subject with this code, or this name at the same level, already exists');
  }
  await recordAudit({ ...context, action: 'subject.update', targetTable: 'subjects', targetId: id, details: { before, changes: data } });
  return findSubject(id);
}

export async function deleteSubject(id, context) {
  const before = await findSubject(id);
  await query('DELETE FROM subjects WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'subject.delete', targetTable: 'subjects', targetId: id, details: before });
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------

const ASSIGNMENT_SELECT = `SELECT ta.id, ta.teacher_id AS teacherId, u.full_name AS teacherName,
    ta.subject_id AS subjectId, sub.name AS subjectName, sub.code AS subjectCode,
    ta.class_id AS classId, c.class_name AS className, c.level,
    ta.stream_id AS streamId, st.stream_name AS streamName,
    ta.academic_year_id AS academicYearId, ay.year_label AS yearLabel
  FROM teacher_assignments ta
  JOIN users u ON u.id = ta.teacher_id
  JOIN subjects sub ON sub.id = ta.subject_id
  JOIN classes c ON c.id = ta.class_id
  LEFT JOIN streams st ON st.id = ta.stream_id
  JOIN academic_years ay ON ay.id = ta.academic_year_id`;

async function findAssignment(id) {
  const row = await queryOne(`${ASSIGNMENT_SELECT} WHERE ta.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Assignment not found');
  return row;
}

async function resolveAcademicYearId(academicYearId) {
  if (academicYearId) return academicYearId;
  const { academicYear } = await getCurrentPeriod();
  return academicYear ? academicYear.id : null;
}

export async function listAssignments({ academicYearId, teacherId, classId, subjectId } = {}) {
  const yearId = await resolveAcademicYearId(academicYearId);
  if (!yearId) return [];
  const where = ['ta.academic_year_id = ?'];
  const params = [yearId];
  if (teacherId) {
    where.push('ta.teacher_id = ?');
    params.push(teacherId);
  }
  if (classId) {
    where.push('ta.class_id = ?');
    params.push(classId);
  }
  if (subjectId) {
    where.push('ta.subject_id = ?');
    params.push(subjectId);
  }
  return query(
    `${ASSIGNMENT_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY ${LEVEL_ORDER}, c.sort_order, st.display_order, st.stream_name, sub.display_order, sub.name`,
    params,
  );
}

export async function createAssignment(data, context) {
  const academicYearId = await resolveAcademicYearId(data.academicYearId);
  if (!academicYearId) throw ApiError.badRequest('Set the current academic year before assigning teachers');

  await assertActiveTeacher(data.teacherId);
  const [subject, cls, year] = await Promise.all([
    queryOne('SELECT id, level, is_active AS isActive FROM subjects WHERE id = ?', [data.subjectId]),
    queryOne('SELECT id, level FROM classes WHERE id = ?', [data.classId]),
    queryOne('SELECT id FROM academic_years WHERE id = ?', [academicYearId]),
  ]);
  const errors = {};
  if (!subject || subject.isActive !== 1) errors.subjectId = 'Subject not found or inactive';
  if (!cls) errors.classId = 'Class not found';
  if (!year) errors.academicYearId = 'Academic year not found';
  if (subject && cls && subject.level !== cls.level) errors.subjectId = 'Subject level does not match the class level';
  if (data.streamId) {
    const stream = await queryOne('SELECT id FROM streams WHERE id = ? AND class_id = ?', [data.streamId, data.classId]);
    if (!stream) errors.streamId = 'Stream does not belong to the selected class';
  }
  if (Object.keys(errors).length > 0) throw ApiError.badRequest('Please correct the highlighted fields', errors);

  // A class-wide assignment and a stream-specific one for the same subject would overlap.
  const overlap = await queryOne(
    `SELECT ta.id FROM teacher_assignments ta
      WHERE ta.subject_id = ? AND ta.class_id = ? AND ta.academic_year_id = ?
        AND ${data.streamId ? 'ta.stream_id IS NULL' : 'ta.stream_id IS NOT NULL'}
      LIMIT 1`,
    [data.subjectId, data.classId, academicYearId],
  );
  if (overlap) {
    throw ApiError.conflict(data.streamId
      ? 'This subject is already assigned for the whole class. Remove that assignment first.'
      : 'This subject already has stream-specific assignments in this class. Remove them first.');
  }

  let result;
  try {
    result = await query(
      `INSERT INTO teacher_assignments (teacher_id, subject_id, class_id, stream_id, academic_year_id)
       VALUES (?, ?, ?, ?, ?)`,
      [data.teacherId, data.subjectId, data.classId, data.streamId ?? null, academicYearId],
    );
  } catch (error) {
    rethrowDuplicate(error, 'This subject is already assigned to a teacher for that class/stream');
  }
  await recordAudit({
    ...context,
    action: 'teacher_assignment.create',
    targetTable: 'teacher_assignments',
    targetId: result.insertId,
    details: { ...data, academicYearId },
  });
  return findAssignment(result.insertId);
}

/** Re-assign a subject slot to a different teacher. */
export async function updateAssignment(id, data, context) {
  const before = await findAssignment(id);
  await assertActiveTeacher(data.teacherId);
  await query('UPDATE teacher_assignments SET teacher_id = ? WHERE id = ?', [data.teacherId, id]);
  await recordAudit({
    ...context,
    action: 'teacher_assignment.update',
    targetTable: 'teacher_assignments',
    targetId: id,
    details: { fromTeacherId: before.teacherId, toTeacherId: data.teacherId },
  });
  return findAssignment(id);
}

export async function deleteAssignment(id, context) {
  const before = await findAssignment(id);
  await query('DELETE FROM teacher_assignments WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'teacher_assignment.delete', targetTable: 'teacher_assignments', targetId: id, details: before });
}
