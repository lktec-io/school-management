import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { placeholders, round } from '../../utils/sql.js';

/**
 * Term balance for each student:
 *   bill     = mandatory fee structures of the student's class
 *            + optional structures the student is allocated to
 *   discount = active waivers (fixed or % of a fee type, or of the whole bill), capped at the bill
 *   balance  = (bill − discount) − confirmed payments for the term
 * A negative balance is a credit (overpayment).
 */

export async function findTerm(termId) {
  const term = await queryOne(
    `SELECT t.id, t.term_name AS termName, t.term_number AS termNumber, t.start_date AS startDate,
            t.end_date AS endDate, t.academic_year_id AS academicYearId, ay.year_label AS yearLabel
       FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id WHERE t.id = ?`,
    [termId],
  );
  if (!term) throw ApiError.notFound('Term not found');
  return term;
}

/**
 * @param {number} termId
 * @param {{ studentIds?: number[], classId?: number, streamId?: number, statuses?: string[], search?: string }} filters
 */
export async function computeTermBalances(termId, { studentIds, classId, streamId, statuses = ['active', 'suspended'], search } = {}) {
  const where = [];
  const params = [];
  if (studentIds) {
    if (studentIds.length === 0) return [];
    where.push(`s.id IN (${placeholders(studentIds.length)})`);
    params.push(...studentIds);
  }
  if (classId) {
    where.push('s.class_id = ?');
    params.push(classId);
  }
  if (streamId) {
    where.push('s.stream_id = ?');
    params.push(streamId);
  }
  if (statuses?.length) {
    where.push(`s.status IN (${placeholders(statuses.length)})`);
    params.push(...statuses);
  }
  if (search) {
    const term = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    where.push("(s.registration_number LIKE ? OR CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) LIKE ?)");
    params.push(term, term);
  }

  const students = await query(
    `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
            s.last_name AS lastName, s.status, s.class_id AS classId, c.class_name AS className,
            s.stream_id AS streamId, st.stream_name AS streamName, s.parent_name AS parentName, s.parent_phone AS parentPhone
       FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN streams st ON st.id = s.stream_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.sort_order, st.stream_name, s.first_name, s.last_name`,
    params,
  );
  if (students.length === 0) return [];

  const ids = students.map((student) => student.id);
  const idList = placeholders(ids.length);

  const [structures, allocations, discounts, payments] = await Promise.all([
    query(
      `SELECT fs.id, fs.fee_type_id AS feeTypeId, ft.name AS feeTypeName, fs.class_id AS classId,
              fs.amount, fs.is_mandatory AS isMandatory
         FROM fee_structures fs JOIN fee_types ft ON ft.id = fs.fee_type_id
        WHERE fs.term_id = ?
        ORDER BY fs.is_mandatory DESC, ft.name`,
      [termId],
    ),
    query(
      `SELECT a.student_id AS studentId, a.fee_structure_id AS feeStructureId
         FROM student_fee_allocations a JOIN fee_structures fs ON fs.id = a.fee_structure_id
        WHERE fs.term_id = ? AND a.student_id IN (${idList})`,
      [termId, ...ids],
    ),
    query(
      `SELECT d.id, d.student_id AS studentId, d.fee_type_id AS feeTypeId, ft.name AS feeTypeName,
              d.discount_type AS discountType, d.value, d.reason
         FROM student_fee_discounts d LEFT JOIN fee_types ft ON ft.id = d.fee_type_id
        WHERE d.term_id = ? AND d.status = 'active' AND d.student_id IN (${idList})`,
      [termId, ...ids],
    ),
    query(
      `SELECT student_id AS studentId, SUM(amount_paid) AS paid, COUNT(*) AS payments, MAX(payment_date) AS lastPaymentDate
         FROM fee_payments
        WHERE term_id = ? AND status = 'confirmed' AND student_id IN (${idList})
        GROUP BY student_id`,
      [termId, ...ids],
    ),
  ]);

  const structuresByClass = new Map();
  for (const structure of structures) {
    if (!structuresByClass.has(structure.classId)) structuresByClass.set(structure.classId, []);
    structuresByClass.get(structure.classId).push({ ...structure, amount: Number(structure.amount), isMandatory: structure.isMandatory === 1 });
  }
  const allocated = new Set(allocations.map((row) => `${row.studentId}:${row.feeStructureId}`));
  const discountsByStudent = new Map();
  for (const discount of discounts) {
    if (!discountsByStudent.has(discount.studentId)) discountsByStudent.set(discount.studentId, []);
    discountsByStudent.get(discount.studentId).push({ ...discount, value: Number(discount.value) });
  }
  const paymentsByStudent = new Map(payments.map((row) => [row.studentId, row]));

  return students.map((student) => {
    const items = (structuresByClass.get(student.classId) ?? [])
      .filter((structure) => structure.isMandatory || allocated.has(`${student.id}:${structure.id}`))
      .map((structure) => ({
        feeStructureId: structure.id,
        feeTypeId: structure.feeTypeId,
        feeTypeName: structure.feeTypeName,
        amount: structure.amount,
        isMandatory: structure.isMandatory,
      }));
    const gross = round(items.reduce((sum, item) => sum + item.amount, 0));

    const appliedDiscounts = (discountsByStudent.get(student.id) ?? []).map((discount) => {
      const base = discount.feeTypeId
        ? items.filter((item) => item.feeTypeId === discount.feeTypeId).reduce((sum, item) => sum + item.amount, 0)
        : gross;
      const amount = discount.discountType === 'percentage'
        ? round((base * discount.value) / 100)
        : Math.min(discount.value, base);
      return { ...discount, amount: round(amount) };
    });
    const discount = round(Math.min(gross, appliedDiscounts.reduce((sum, item) => sum + item.amount, 0)));
    const payment = paymentsByStudent.get(student.id);
    const paid = round(Number(payment?.paid ?? 0));
    const expected = round(gross - discount);

    return {
      studentId: student.id,
      registrationNumber: student.registrationNumber,
      fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
      firstName: student.firstName,
      status: student.status,
      classId: student.classId,
      className: student.className,
      streamId: student.streamId,
      streamName: student.streamName,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      items,
      discounts: appliedDiscounts,
      gross,
      discount,
      expected,
      paid,
      balance: round(expected - paid),
      paymentsCount: payment?.payments ?? 0,
      lastPaymentDate: payment?.lastPaymentDate ?? null,
    };
  });
}

export async function studentTermBalance(studentId, termId) {
  const [balance] = await computeTermBalances(termId, { studentIds: [studentId], statuses: null });
  if (!balance) throw ApiError.notFound('Student not found');
  return balance;
}
