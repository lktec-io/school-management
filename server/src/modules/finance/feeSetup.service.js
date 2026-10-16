import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { buildUpdateSet, placeholders, rethrowDuplicate, withBooleans, withNumbers } from '../../utils/sql.js';
import { findTerm } from './balances.service.js';

// ---------------------------------------------------------------------------
// Fee types
// ---------------------------------------------------------------------------

const FEE_TYPE_SELECT = `SELECT ft.id, ft.name, ft.code, ft.description, ft.display_order AS displayOrder, ft.is_active AS isActive,
    (SELECT COUNT(*) FROM fee_structures fs WHERE fs.fee_type_id = ft.id) AS structures
  FROM fee_types ft`;

async function findFeeType(id) {
  const row = await queryOne(`${FEE_TYPE_SELECT} WHERE ft.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Fee type not found');
  return withBooleans(row, ['isActive']);
}

export async function listFeeTypes({ includeInactive = false } = {}) {
  const rows = await query(`${FEE_TYPE_SELECT} ${includeInactive ? '' : 'WHERE ft.is_active = 1'} ORDER BY ft.display_order, ft.name`);
  return withBooleans(rows, ['isActive']);
}

export async function createFeeType(data, context) {
  let result;
  try {
    result = await query(
      'INSERT INTO fee_types (name, code, description, display_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.code, data.description ?? null, data.displayOrder ?? 0, Number(data.isActive ?? true)],
    );
  } catch (error) {
    rethrowDuplicate(error, 'A fee type with this name or code already exists');
  }
  await recordAudit({ ...context, action: 'fee_type.create', targetTable: 'fee_types', targetId: result.insertId, details: data });
  return findFeeType(result.insertId);
}

export async function updateFeeType(id, data, context) {
  const before = await findFeeType(id);
  const { sets, params } = buildUpdateSet(data, { name: 'name', code: 'code', description: 'description', displayOrder: 'display_order', isActive: 'is_active' });
  try {
    await query(`UPDATE fee_types SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, 'A fee type with this name or code already exists');
  }
  await recordAudit({ ...context, action: 'fee_type.update', targetTable: 'fee_types', targetId: id, details: { before, changes: data } });
  return findFeeType(id);
}

export async function deleteFeeType(id, context) {
  const before = await findFeeType(id);
  await query('DELETE FROM fee_types WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'fee_type.delete', targetTable: 'fee_types', targetId: id, details: before });
}

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------

const STRUCTURE_SELECT = `SELECT fs.id, fs.fee_type_id AS feeTypeId, ft.name AS feeTypeName, ft.code AS feeTypeCode,
    fs.class_id AS classId, c.class_name AS className, c.level, fs.term_id AS termId, t.term_name AS termName,
    ay.year_label AS yearLabel, fs.amount, fs.currency, fs.is_mandatory AS isMandatory,
    (SELECT COUNT(*) FROM student_fee_allocations a WHERE a.fee_structure_id = fs.id) AS allocatedStudents,
    u.full_name AS createdByName, fs.updated_at AS updatedAt
  FROM fee_structures fs
  JOIN fee_types ft ON ft.id = fs.fee_type_id
  JOIN classes c ON c.id = fs.class_id
  JOIN terms t ON t.id = fs.term_id
  JOIN academic_years ay ON ay.id = t.academic_year_id
  JOIN users u ON u.id = fs.created_by`;

const decorateStructure = (row) => withBooleans(withNumbers(row, ['amount']), ['isMandatory']);

async function findStructure(id) {
  const row = await queryOne(`${STRUCTURE_SELECT} WHERE fs.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Fee structure not found');
  return decorateStructure(row);
}

export async function listStructures({ termId, classId }) {
  const where = ['fs.term_id = ?'];
  const params = [termId];
  if (classId) {
    where.push('fs.class_id = ?');
    params.push(classId);
  }
  const rows = await query(
    `${STRUCTURE_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY FIELD(c.level, 'nursery', 'primary', 'o_level', 'a_level'), c.sort_order, fs.is_mandatory DESC, ft.display_order, ft.name`,
    params,
  );
  return rows.map(decorateStructure);
}

/** Create the same fee item for one or more classes in a single transaction. */
export async function createStructures(data, user, context) {
  await findTerm(data.termId);
  const feeType = await queryOne('SELECT id, is_active AS isActive FROM fee_types WHERE id = ?', [data.feeTypeId]);
  if (!feeType || feeType.isActive !== 1) {
    throw ApiError.badRequest('Please correct the highlighted fields', { feeTypeId: 'Fee type not found or inactive' });
  }
  const classes = await query(`SELECT id FROM classes WHERE id IN (${placeholders(data.classIds.length)})`, data.classIds);
  if (classes.length !== data.classIds.length) {
    throw ApiError.badRequest('Please correct the highlighted fields', { classIds: 'One or more classes do not exist' });
  }

  const ids = await withTransaction(async (connection) => {
    const created = [];
    for (const classId of data.classIds) {
      try {
        const result = await query(
          `INSERT INTO fee_structures (fee_type_id, class_id, term_id, amount, is_mandatory, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [data.feeTypeId, classId, data.termId, data.amount, Number(data.isMandatory ?? true), user.id],
          connection,
        );
        created.push(result.insertId);
      } catch (error) {
        rethrowDuplicate(error, 'This fee type is already set for one of the selected classes in this term — edit it instead');
      }
    }
    await recordAudit({
      ...context, action: 'fee_structure.create', targetTable: 'fee_structures', targetId: created[0], details: { ...data, ids: created },
    }, connection);
    return created;
  });
  return Promise.all(ids.map(findStructure));
}

export async function updateStructure(id, data, context) {
  const before = await findStructure(id);
  if (data.isMandatory === true && before.allocatedStudents > 0) {
    throw ApiError.conflict('Remove the individual student allocations before making this fee mandatory');
  }
  const { sets, params } = buildUpdateSet(data, { amount: 'amount', isMandatory: 'is_mandatory' });
  await query(`UPDATE fee_structures SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  await recordAudit({ ...context, action: 'fee_structure.update', targetTable: 'fee_structures', targetId: id, details: { before, changes: data } });
  return findStructure(id);
}

export async function deleteStructure(id, context) {
  const before = await findStructure(id);
  if (before.allocatedStudents > 0) throw ApiError.conflict('Students are allocated to this fee. Remove the allocations first.');
  await query('DELETE FROM fee_structures WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'fee_structure.delete', targetTable: 'fee_structures', targetId: id, details: before });
}

/** Copy every fee structure from one term to another (existing items in the target are kept). */
export async function copyStructures({ fromTermId, toTermId }, user, context) {
  if (fromTermId === toTermId) throw ApiError.badRequest('Choose two different terms');
  await Promise.all([findTerm(fromTermId), findTerm(toTermId)]);
  const result = await withTransaction(async (connection) => {
    const inserted = await query(
      `INSERT INTO fee_structures (fee_type_id, class_id, term_id, amount, currency, is_mandatory, created_by)
       SELECT src.fee_type_id, src.class_id, ?, src.amount, src.currency, src.is_mandatory, ?
         FROM fee_structures src
        WHERE src.term_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM fee_structures dst
             WHERE dst.term_id = ? AND dst.fee_type_id = src.fee_type_id AND dst.class_id = src.class_id)`,
      [toTermId, user.id, fromTermId, toTermId],
      connection,
    );
    await recordAudit({
      ...context, action: 'fee_structure.copy', targetTable: 'fee_structures', details: { fromTermId, toTermId, copied: inserted.affectedRows },
    }, connection);
    return inserted.affectedRows;
  });
  return { copied: result };
}

// ---------------------------------------------------------------------------
// Optional fee allocations
// ---------------------------------------------------------------------------

export async function listAllocations(structureId) {
  const structure = await findStructure(structureId);
  const students = await query(
    `SELECT s.id AS studentId, s.registration_number AS registrationNumber, s.first_name AS firstName,
            s.middle_name AS middleName, s.last_name AS lastName, st.stream_name AS streamName, s.status,
            (a.id IS NOT NULL) AS allocated
       FROM students s
       LEFT JOIN streams st ON st.id = s.stream_id
       LEFT JOIN student_fee_allocations a ON a.student_id = s.id AND a.fee_structure_id = ?
      WHERE s.class_id = ? AND (s.status IN ('active', 'suspended') OR a.id IS NOT NULL)
      ORDER BY st.display_order, st.stream_name, s.first_name, s.last_name`,
    [structureId, structure.classId],
  );
  return {
    structure,
    students: students.map((row) => ({
      ...row,
      allocated: Number(row.allocated) === 1,
      fullName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
    })),
  };
}

/** Replace the set of students allocated to an optional fee. */
export async function setAllocations(structureId, studentIds, user, context) {
  const structure = await findStructure(structureId);
  if (structure.isMandatory) throw ApiError.badRequest('Mandatory fees apply to every student in the class automatically');
  if (studentIds.length) {
    const valid = await query(
      `SELECT id FROM students WHERE class_id = ? AND id IN (${placeholders(studentIds.length)})`,
      [structure.classId, ...studentIds],
    );
    if (valid.length !== studentIds.length) throw ApiError.badRequest('Some students are not in this class');
  }

  const result = await withTransaction(async (connection) => {
    const current = await query(
      'SELECT student_id AS studentId FROM student_fee_allocations WHERE fee_structure_id = ? FOR UPDATE',
      [structureId],
      connection,
    );
    const currentIds = new Set(current.map((row) => row.studentId));
    const target = new Set(studentIds);
    const added = studentIds.filter((id) => !currentIds.has(id));
    const removed = [...currentIds].filter((id) => !target.has(id));

    if (removed.length) {
      await query(
        `DELETE FROM student_fee_allocations WHERE fee_structure_id = ? AND student_id IN (${placeholders(removed.length)})`,
        [structureId, ...removed],
        connection,
      );
    }
    if (added.length) {
      await query(
        `INSERT INTO student_fee_allocations (student_id, fee_structure_id, assigned_by)
         VALUES ${added.map(() => '(?, ?, ?)').join(', ')}`,
        added.flatMap((id) => [id, structureId, user.id]),
        connection,
      );
    }
    if (added.length || removed.length) {
      await recordAudit({
        ...context, action: 'fee_allocation.update', targetTable: 'student_fee_allocations', targetId: structureId, details: { added, removed },
      }, connection);
    }
    return { added: added.length, removed: removed.length };
  });
  return { ...result, total: studentIds.length };
}

// ---------------------------------------------------------------------------
// Discounts & waivers
// ---------------------------------------------------------------------------

const DISCOUNT_SELECT = `SELECT d.id, d.student_id AS studentId, s.registration_number AS registrationNumber,
    s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName, c.class_name AS className,
    d.term_id AS termId, t.term_name AS termName, ay.year_label AS yearLabel,
    d.fee_type_id AS feeTypeId, ft.name AS feeTypeName, d.discount_type AS discountType, d.value, d.reason,
    d.status, gu.full_name AS grantedByName, d.created_at AS createdAt,
    ru.full_name AS revokedByName, d.revoked_at AS revokedAt, d.revoke_reason AS revokeReason
  FROM student_fee_discounts d
  JOIN students s ON s.id = d.student_id
  JOIN classes c ON c.id = s.class_id
  JOIN terms t ON t.id = d.term_id
  JOIN academic_years ay ON ay.id = t.academic_year_id
  LEFT JOIN fee_types ft ON ft.id = d.fee_type_id
  JOIN users gu ON gu.id = d.granted_by
  LEFT JOIN users ru ON ru.id = d.revoked_by`;

const decorateDiscount = (row) => ({
  ...withNumbers(row, ['value']),
  fullName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
});

async function findDiscount(id) {
  const row = await queryOne(`${DISCOUNT_SELECT} WHERE d.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Discount not found');
  return decorateDiscount(row);
}

export async function listDiscounts({ termId, studentId, status }) {
  const where = [];
  const params = [];
  if (termId) {
    where.push('d.term_id = ?');
    params.push(termId);
  }
  if (studentId) {
    where.push('d.student_id = ?');
    params.push(studentId);
  }
  if (status) {
    where.push('d.status = ?');
    params.push(status);
  }
  const rows = await query(
    `${DISCOUNT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY d.created_at DESC LIMIT 500`,
    params,
  );
  return rows.map(decorateDiscount);
}

export async function createDiscount(data, user, context) {
  const [student] = await Promise.all([
    queryOne('SELECT id FROM students WHERE id = ?', [data.studentId]),
    findTerm(data.termId),
  ]);
  if (!student) throw ApiError.badRequest('Please correct the highlighted fields', { studentId: 'Student not found' });
  if (data.feeTypeId) {
    const feeType = await queryOne('SELECT id FROM fee_types WHERE id = ?', [data.feeTypeId]);
    if (!feeType) throw ApiError.badRequest('Please correct the highlighted fields', { feeTypeId: 'Fee type not found' });
  }
  const result = await query(
    `INSERT INTO student_fee_discounts (student_id, term_id, fee_type_id, discount_type, value, reason, granted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.studentId, data.termId, data.feeTypeId ?? null, data.discountType, data.value, data.reason, user.id],
  );
  await recordAudit({ ...context, action: 'fee_discount.grant', targetTable: 'student_fee_discounts', targetId: result.insertId, details: data });
  return findDiscount(result.insertId);
}

export async function revokeDiscount(id, reason, user, context) {
  const before = await findDiscount(id);
  if (before.status !== 'active') throw ApiError.conflict('This discount has already been revoked');
  await query(
    `UPDATE student_fee_discounts
        SET status = 'revoked', revoked_by = ?, revoked_at = NOW(), revoke_reason = ?
      WHERE id = ?`,
    [user.id, reason, id],
  );
  await recordAudit({ ...context, action: 'fee_discount.revoke', targetTable: 'student_fee_discounts', targetId: id, details: { reason, before } });
  return findDiscount(id);
}
