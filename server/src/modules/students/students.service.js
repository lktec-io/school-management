import path from 'node:path';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { paginated } from '../../utils/pagination.js';
import { nextSequenceValue, peekSequenceValue } from '../../utils/sequences.js';
import { buildUpdateSet, likeContains, withNumbers } from '../../utils/sql.js';
import { teacherClassIds } from '../academics/access.service.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { gradeFor, loadGradingScales, scaleForLevel } from '../exams/grading.js';
import { studentTermBalance } from '../finance/balances.service.js';
import { registrationPrefix } from '../system/settings.service.js';

export const STUDENT_STATUSES = ['active', 'suspended', 'transferred', 'graduated', 'withdrawn'];

/** Allowed lifecycle moves. Graduation is final; transferred/withdrawn students may be re-admitted. */
const STATUS_TRANSITIONS = {
  active: ['suspended', 'transferred', 'graduated', 'withdrawn'],
  suspended: ['active', 'transferred', 'withdrawn'],
  transferred: ['active'],
  withdrawn: ['active'],
  graduated: [],
};

const STUDENT_COLUMNS = {
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  gender: 'gender',
  dob: 'dob',
  classId: 'class_id',
  streamId: 'stream_id',
  parentName: 'parent_name',
  parentPhone: 'parent_phone',
  parentRelationship: 'parent_relationship',
  parentUserId: 'parent_user_id',
  address: 'address',
  admissionDate: 'admission_date',
  status: 'status',
};

const STUDENT_SELECT = `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName,
    s.middle_name AS middleName, s.last_name AS lastName, s.gender, s.dob,
    s.class_id AS classId, c.class_name AS className, c.level,
    s.stream_id AS streamId, st.stream_name AS streamName,
    s.parent_name AS parentName, s.parent_phone AS parentPhone, s.parent_relationship AS parentRelationship,
    s.parent_user_id AS parentUserId, pu.full_name AS parentAccountName,
    s.address, s.admission_date AS admissionDate, s.status, s.photo_path AS photoPath,
    s.created_at AS createdAt, s.updated_at AS updatedAt
  FROM students s
  JOIN classes c ON c.id = s.class_id
  LEFT JOIN streams st ON st.id = s.stream_id
  LEFT JOIN users pu ON pu.id = s.parent_user_id`;

const SORTS = {
  name: 's.first_name {dir}, s.last_name {dir}',
  regNo: 's.registration_number {dir}',
  class: "FIELD(c.level, 'nursery', 'primary', 'o_level', 'a_level') {dir}, c.sort_order {dir}, st.stream_name {dir}, s.first_name ASC",
  admitted: 's.admission_date {dir}, s.id {dir}',
};

export function fullName(student) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ');
}

/** API-relative photo URL (client prefixes the API base); the file name changes per upload, so it doubles as a cache-buster. */
export function studentPhotoUrl(id, photoPath) {
  if (!photoPath) return null;
  const version = path.posix.basename(photoPath).replace(/\.[a-z]+$/, '');
  return `/students/${id}/photo?v=${encodeURIComponent(version)}`;
}

const decorate = ({ photoPath, ...student }) => ({
  ...student,
  fullName: fullName(student),
  photoUrl: studentPhotoUrl(student.id, photoPath),
});

/** Row-level visibility: teachers see their classes, parents see their own children. */
async function scopeFor(user) {
  if (user.role === 'parent') return { sql: 's.parent_user_id = ?', params: [user.id] };
  if (user.role === 'teacher') {
    const { academicYear } = await getCurrentPeriod();
    const classIds = await teacherClassIds(user.id, academicYear?.id);
    if (classIds.length === 0) return { sql: '1 = 0', params: [] };
    return { sql: `s.class_id IN (${classIds.map(() => '?').join(', ')})`, params: classIds };
  }
  return { sql: '1 = 1', params: [] };
}

async function findStudent(id, executor) {
  const row = await queryOne(`${STUDENT_SELECT} WHERE s.id = ?`, [id], executor);
  if (!row) throw ApiError.notFound('Student not found');
  return decorate(row);
}

/** Stored photo path of a student the user may see (404 otherwise). */
export async function visiblePhotoPath(id, user) {
  const scope = await scopeFor(user);
  const row = await queryOne(`SELECT s.photo_path AS photoPath FROM students s WHERE s.id = ? AND ${scope.sql}`, [id, ...scope.params]);
  if (!row) throw ApiError.notFound('Student not found');
  return row.photoPath;
}

async function findVisibleStudent(id, user) {
  const scope = await scopeFor(user);
  const row = await queryOne(`${STUDENT_SELECT} WHERE s.id = ? AND ${scope.sql}`, [id, ...scope.params]);
  // 404 rather than 403 so other students' existence is not disclosed.
  if (!row) throw ApiError.notFound('Student not found');
  return decorate(row);
}

async function assertPlacement(classId, streamId, { excludeStudentId } = {}) {
  const cls = await queryOne('SELECT id, is_active AS isActive FROM classes WHERE id = ?', [classId]);
  if (!cls || cls.isActive !== 1) {
    throw ApiError.badRequest('Please correct the highlighted fields', { classId: 'Class not found or inactive' });
  }
  if (!streamId) return;
  const stream = await queryOne(
    `SELECT st.id, st.capacity, st.is_active AS isActive,
            (SELECT COUNT(*) FROM students s WHERE s.stream_id = st.id AND s.status = 'active' AND s.id <> ?) AS occupied
       FROM streams st WHERE st.id = ? AND st.class_id = ?`,
    [excludeStudentId ?? 0, streamId, classId],
  );
  if (!stream || stream.isActive !== 1) {
    throw ApiError.badRequest('Please correct the highlighted fields', { streamId: 'Stream does not belong to the selected class' });
  }
  if (stream.capacity !== null && stream.occupied >= stream.capacity) {
    throw ApiError.conflict(`This stream is full (capacity ${stream.capacity}). Choose another stream.`);
  }
}

async function assertParentAccount(parentUserId) {
  const user = await queryOne('SELECT role, status FROM users WHERE id = ?', [parentUserId]);
  if (!user || user.role !== 'parent' || user.status !== 'active') {
    throw ApiError.badRequest('Please correct the highlighted fields', { parentUserId: 'Must be an active parent account' });
  }
}

export async function listStudents({ classId, streamId, status, gender, search, sort = 'name', dir = 'asc' }, pagination, user) {
  const scope = await scopeFor(user);
  const where = [scope.sql];
  const params = [...scope.params];
  if (classId) {
    where.push('s.class_id = ?');
    params.push(classId);
  }
  if (streamId) {
    where.push('s.stream_id = ?');
    params.push(streamId);
  }
  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }
  if (gender) {
    where.push('s.gender = ?');
    params.push(gender);
  }
  if (search) {
    const term = likeContains(search);
    where.push(`(s.registration_number LIKE ? OR CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) LIKE ?
      OR CONCAT_WS(' ', s.first_name, s.last_name) LIKE ? OR s.parent_phone LIKE ?)`);
    params.push(term, term, term, term);
  }
  const whereSql = where.join(' AND ');
  const order = (SORTS[sort] || SORTS.name).replaceAll('{dir}', dir === 'desc' ? 'DESC' : 'ASC');

  const { total } = await queryOne(
    `SELECT COUNT(*) AS total FROM students s JOIN classes c ON c.id = s.class_id
       LEFT JOIN streams st ON st.id = s.stream_id WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `${STUDENT_SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
    params,
  );
  return paginated(rows.map(decorate), total, pagination);
}

export function formatRegistrationNumber(prefix, year, sequence) {
  return `${prefix}/${year}/${String(sequence).padStart(3, '0')}`;
}

/** The number the next student admitted in that year would get (preview only; assigned on save). */
export async function previewRegistrationNumber(admissionDate = todayInSchoolTz()) {
  const year = admissionDate.slice(0, 4);
  return { registrationNumber: formatRegistrationNumber(await registrationPrefix(), year, await peekSequenceValue(`REGNO-${year}`)) };
}

/**
 * Insert one validated student inside the caller's transaction: reserves the next PREFIX/YEAR/SEQ number
 * and writes the audit entry. Returns { id, registrationNumber }.
 */
export async function insertStudent(connection, data, { prefix, context, source = 'form' }) {
  const admissionDate = data.admissionDate ?? todayInSchoolTz();
  const year = admissionDate.slice(0, 4);
  const sequence = await nextSequenceValue(connection, `REGNO-${year}`);
  const registrationNumber = formatRegistrationNumber(prefix, year, sequence);
  const result = await query(
    `INSERT INTO students (registration_number, first_name, middle_name, last_name, gender, dob, class_id,
       stream_id, parent_name, parent_phone, parent_relationship, parent_user_id, address, admission_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      registrationNumber, data.firstName, data.middleName ?? null, data.lastName, data.gender, data.dob,
      data.classId, data.streamId ?? null, data.parentName, data.parentPhone, data.parentRelationship ?? null,
      data.parentUserId ?? null, data.address ?? null, admissionDate,
    ],
    connection,
  );
  await recordAudit(
    {
      ...context,
      action: 'student.register',
      targetTable: 'students',
      targetId: result.insertId,
      details: { registrationNumber, ...data, admissionDate, ...(source === 'form' ? {} : { source }) },
    },
    connection,
  );
  return { id: result.insertId, registrationNumber };
}

export async function registerStudent(data, context) {
  await assertPlacement(data.classId, data.streamId);
  if (data.parentUserId) await assertParentAccount(data.parentUserId);
  const prefix = await registrationPrefix();
  const { id } = await withTransaction((connection) => insertStudent(connection, data, { prefix, context }));
  return findStudent(id);
}

export async function updateStudent(id, data, context) {
  const before = await findStudent(id);
  const changes = { ...data };
  const statusReason = changes.statusReason;
  delete changes.statusReason;

  if (changes.status !== undefined && changes.status !== before.status) {
    const allowed = STATUS_TRANSITIONS[before.status] || [];
    if (!allowed.includes(changes.status)) {
      throw ApiError.badRequest(
        allowed.length
          ? `A ${before.status} student can only be changed to: ${allowed.join(', ')}`
          : `A ${before.status} student's status cannot be changed`,
        { status: 'Invalid status transition' },
      );
    }
  }

  const classChanging = changes.classId !== undefined && changes.classId !== before.classId;
  // A stream belongs to one class, so moving class without naming a stream clears it.
  if (classChanging && changes.streamId === undefined) changes.streamId = null;

  const targetClassId = changes.classId ?? before.classId;
  const targetStreamId = changes.streamId !== undefined ? changes.streamId : before.streamId;
  if (classChanging || (changes.streamId !== undefined && changes.streamId !== before.streamId)) {
    await assertPlacement(targetClassId, targetStreamId, { excludeStudentId: id });
  }
  if (changes.parentUserId) await assertParentAccount(changes.parentUserId);

  const { sets, params } = buildUpdateSet(changes, STUDENT_COLUMNS);
  if (sets.length === 0) throw ApiError.badRequest('No changes were submitted');

  const diff = {};
  for (const field of Object.keys(STUDENT_COLUMNS)) {
    if (changes[field] !== undefined && changes[field] !== before[field]) {
      diff[field] = { from: before[field], to: changes[field] };
    }
  }

  await withTransaction(async (connection) => {
    await query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, [...params, id], connection);
    await recordAudit(
      {
        ...context,
        action: diff.status ? 'student.status_change' : 'student.update',
        targetTable: 'students',
        targetId: id,
        details: { registrationNumber: before.registrationNumber, changes: diff, statusReason: statusReason ?? null },
      },
      connection,
    );
  });

  return findStudent(id);
}

/** Per-exam results history of one student (parents only see published exams). */
export async function getPerformance(studentId, user) {
  const statusFilter = user.role === 'parent'
    ? "AND e.status = 'published'"
    : user.role === 'admin' ? '' : "AND e.status <> 'draft'";

  const rows = await query(
    `SELECT r.examId, e.name AS examName, e.exam_type AS examType, e.status AS examStatus,
            t.term_name AS termName, ay.year_label AS yearLabel,
            r.classId, c.class_name AS className, c.level,
            r.subjectsSat, r.totalScore, r.averagePct, r.classPosition, r.classSize
       FROM (
         SELECT ps.*,
                RANK() OVER (PARTITION BY ps.examId, ps.classId ORDER BY ps.averagePct DESC, ps.totalScore DESC) AS classPosition,
                COUNT(*) OVER (PARTITION BY ps.examId, ps.classId) AS classSize
           FROM (
             SELECT m.exam_id AS examId, m.class_id AS classId, m.student_id AS studentId,
                    COUNT(*) AS subjectsSat, SUM(m.score) AS totalScore,
                    ROUND(AVG(m.score / ex.max_score * 100), 2) AS averagePct
               FROM marks m
               JOIN exams ex ON ex.id = m.exam_id
              WHERE m.is_absent = 0
                AND m.exam_id IN (SELECT DISTINCT exam_id FROM marks WHERE student_id = ?)
              GROUP BY m.exam_id, m.class_id, m.student_id
           ) ps
       ) r
       JOIN exams e ON e.id = r.examId
       JOIN terms t ON t.id = e.term_id
       JOIN academic_years ay ON ay.id = e.academic_year_id
       JOIN classes c ON c.id = r.classId
      WHERE r.studentId = ? ${statusFilter}
      ORDER BY ay.start_date DESC, t.term_number DESC, e.start_date DESC, e.id DESC`,
    [studentId, studentId],
  );

  const scales = await loadGradingScales();
  return withNumbers(rows, ['totalScore', 'averagePct']).map((row) => {
    const band = gradeFor(scaleForLevel(scales, row.level), row.averagePct);
    return { ...row, grade: band?.grade ?? null, remark: band?.remark ?? null };
  });
}

async function getFees(student) {
  const { term } = await getCurrentPeriod();
  let currentTerm = null;
  if (term) {
    const balance = await studentTermBalance(student.id, term.id);
    currentTerm = {
      termId: term.id,
      termName: term.termName,
      items: balance.items,
      discounts: balance.discounts,
      gross: balance.gross,
      discount: balance.discount,
      expected: balance.expected,
      paid: balance.paid,
      balance: balance.balance,
    };
  }

  const payments = await query(
    `SELECT fp.id, fp.receipt_no AS receiptNo, fp.amount_paid AS amountPaid, fp.payment_mode AS paymentMode,
            fp.reference_no AS referenceNo, fp.payment_date AS paymentDate, fp.status,
            ft.name AS feeTypeName, t.term_name AS termName, ay.year_label AS yearLabel,
            u.full_name AS recordedByName
       FROM fee_payments fp
       JOIN terms t ON t.id = fp.term_id
       JOIN academic_years ay ON ay.id = t.academic_year_id
       LEFT JOIN fee_types ft ON ft.id = fp.fee_type_id
       JOIN users u ON u.id = fp.recorded_by
      WHERE fp.student_id = ?
      ORDER BY fp.payment_date DESC, fp.id DESC
      LIMIT 100`,
    [student.id],
  );

  return { currentTerm, payments: withNumbers(payments, ['amountPaid']) };
}

export async function getStudentProfile(id, user) {
  const student = await findVisibleStudent(id, user);
  const canSeeFees = ['admin', 'accountant', 'parent'].includes(user.role);
  const [performance, fees] = await Promise.all([
    user.role === 'accountant' ? Promise.resolve([]) : getPerformance(id, user),
    canSeeFees ? getFees(student) : Promise.resolve(null),
  ]);
  return {
    student,
    allowedStatusTransitions: user.role === 'admin' ? STATUS_TRANSITIONS[student.status] : [],
    performance,
    fees,
  };
}

/** A single student record (admin context, no scoping). */
export function getStudentRecord(id) {
  return findStudent(id);
}
