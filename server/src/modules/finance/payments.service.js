import env from '../../config/env.js';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { queueMessages, dispatchInBackground, isSmsConfigured } from '../../services/smsService.js';
import { recordAudit } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import logger from '../../utils/logger.js';
import { paginated } from '../../utils/pagination.js';
import { nextSequenceValue } from '../../utils/sequences.js';
import { likeContains, withNumbers } from '../../utils/sql.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { getSchoolProfile } from '../system/settings.service.js';
import { findTerm, studentTermBalance } from './balances.service.js';

export const PAYMENT_MODES = ['cash', 'bank_deposit', 'bank_transfer', 'mobile_money', 'cheque'];

const PAYMENT_SELECT = `SELECT fp.id, fp.receipt_no AS receiptNo, fp.student_id AS studentId,
    s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
    s.last_name AS lastName, s.parent_name AS parentName, s.parent_phone AS parentPhone, s.parent_user_id AS parentUserId,
    c.class_name AS className, st.stream_name AS streamName,
    fp.term_id AS termId, t.term_name AS termName, ay.year_label AS yearLabel,
    fp.fee_type_id AS feeTypeId, ft.name AS feeTypeName,
    fp.amount_paid AS amountPaid, fp.payment_mode AS paymentMode, fp.reference_no AS referenceNo,
    fp.payment_date AS paymentDate, fp.notes, fp.status,
    fp.recorded_by AS recordedBy, ru.full_name AS recordedByName, fp.created_at AS createdAt,
    vu.full_name AS reversedByName, fp.reversed_at AS reversedAt, fp.reversal_reason AS reversalReason
  FROM fee_payments fp
  JOIN students s ON s.id = fp.student_id
  JOIN classes c ON c.id = s.class_id
  LEFT JOIN streams st ON st.id = s.stream_id
  JOIN terms t ON t.id = fp.term_id
  JOIN academic_years ay ON ay.id = t.academic_year_id
  LEFT JOIN fee_types ft ON ft.id = fp.fee_type_id
  JOIN users ru ON ru.id = fp.recorded_by
  LEFT JOIN users vu ON vu.id = fp.reversed_by`;

const decorate = (row) => ({
  ...withNumbers(row, ['amountPaid']),
  fullName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
});

const moneyFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatTzs = (value) => `TZS ${moneyFormatter.format(Number(value))}`;

export async function findPayment(id, user) {
  const row = await queryOne(`${PAYMENT_SELECT} WHERE fp.id = ?`, [id]);
  if (!row || (user?.role === 'parent' && row.parentUserId !== user.id)) throw ApiError.notFound('Payment not found');
  return decorate(row);
}

export async function listPayments(filters, pagination) {
  const where = [];
  const params = [];
  const add = (sql, ...values) => {
    where.push(sql);
    params.push(...values);
  };
  if (filters.termId) add('fp.term_id = ?', filters.termId);
  if (filters.classId) add('s.class_id = ?', filters.classId);
  if (filters.studentId) add('fp.student_id = ?', filters.studentId);
  if (filters.paymentMode) add('fp.payment_mode = ?', filters.paymentMode);
  if (filters.status) add('fp.status = ?', filters.status);
  if (filters.dateFrom) add('fp.payment_date >= ?', filters.dateFrom);
  if (filters.dateTo) add('fp.payment_date <= ?', filters.dateTo);
  if (filters.search) {
    const term = likeContains(filters.search);
    add(`(fp.receipt_no LIKE ? OR fp.reference_no LIKE ? OR s.registration_number LIKE ?
          OR CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) LIKE ?)`, term, term, term, term);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const fromSql = `FROM fee_payments fp JOIN students s ON s.id = fp.student_id ${whereSql}`;

  const totals = await queryOne(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN fp.status = 'confirmed' THEN fp.amount_paid END), 0) AS confirmedAmount,
            COALESCE(SUM(CASE WHEN fp.status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmedCount,
            COALESCE(SUM(CASE WHEN fp.status = 'reversed' THEN fp.amount_paid END), 0) AS reversedAmount
       ${fromSql}`,
    params,
  );
  const rows = await query(
    `${PAYMENT_SELECT} ${whereSql}
     ORDER BY fp.payment_date DESC, fp.id DESC
     LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
    params,
  );
  return {
    ...paginated(rows.map(decorate), totals.total, pagination),
    totals: {
      confirmedAmount: Number(totals.confirmedAmount),
      confirmedCount: Number(totals.confirmedCount),
      reversedAmount: Number(totals.reversedAmount),
    },
  };
}

function confirmationMessage(payment, balance, schoolName) {
  const name = [payment.firstName, payment.lastName].join(' ');
  const balanceText = balance.balance > 0
    ? `${payment.termName} ${payment.yearLabel} balance: ${formatTzs(balance.balance)}.`
    : balance.balance < 0
      ? `${payment.termName} fees fully paid (credit ${formatTzs(-balance.balance)}).`
      : `${payment.termName} fees fully paid.`;
  return `${schoolName}: Received ${formatTzs(payment.amountPaid)} for ${name} (${payment.registrationNumber}), `
    + `receipt ${payment.receiptNo}. ${balanceText} Asante.`;
}

async function queuePaymentConfirmation(payment, balance, user) {
  if (!env.beem.paymentConfirmations) return { queued: false, reason: 'Payment confirmation SMS is disabled' };
  if (!isSmsConfigured()) return { queued: false, reason: 'SMS gateway is not configured' };
  try {
    const { name: schoolName } = await getSchoolProfile();
    const { queuedIds, invalid } = await queueMessages(
      [{ recipient: payment.parentPhone, message: confirmationMessage(payment, balance, schoolName), studentId: payment.studentId }],
      { category: 'payment_receipt', sentBy: user.id },
    );
    dispatchInBackground(queuedIds);
    return invalid ? { queued: false, reason: 'Guardian phone number is invalid' } : { queued: true, reason: null };
  } catch (error) {
    // The payment is already committed; an SMS problem must never undo or block it.
    logger.error('Could not queue payment confirmation SMS', { paymentId: payment.id, error: error.message });
    return { queued: false, reason: 'SMS could not be queued' };
  }
}

export async function recordPayment(data, user, context) {
  const student = await queryOne('SELECT id, status FROM students WHERE id = ?', [data.studentId]);
  if (!student) throw ApiError.badRequest('Please correct the highlighted fields', { studentId: 'Student not found' });

  let termId = data.termId;
  if (!termId) {
    const { term } = await getCurrentPeriod();
    if (!term) throw ApiError.badRequest('No current term is set. Choose the term this payment belongs to.', { termId: 'Term is required' });
    termId = term.id;
  }
  await findTerm(termId);
  if (data.feeTypeId) {
    const feeType = await queryOne('SELECT id FROM fee_types WHERE id = ?', [data.feeTypeId]);
    if (!feeType) throw ApiError.badRequest('Please correct the highlighted fields', { feeTypeId: 'Fee type not found' });
  }

  const paymentDate = data.paymentDate ?? todayInSchoolTz();
  const year = paymentDate.slice(0, 4);

  let paymentId;
  try {
    paymentId = await withTransaction(async (connection) => {
      const sequence = await nextSequenceValue(connection, `RECEIPT-${year}`);
      const receiptNo = `${env.finance.receiptPrefix}-${year}-${String(sequence).padStart(4, '0')}`;
      const result = await query(
        `INSERT INTO fee_payments (receipt_no, student_id, term_id, fee_type_id, amount_paid, payment_mode, reference_no,
           payment_date, notes, status, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
        [receiptNo, data.studentId, termId, data.feeTypeId ?? null, data.amountPaid, data.paymentMode,
          data.referenceNo ?? null, paymentDate, data.notes ?? null, user.id],
        connection,
      );
      await recordAudit({
        ...context,
        action: 'payment.create',
        targetTable: 'fee_payments',
        targetId: result.insertId,
        details: { receiptNo, ...data, termId, paymentDate },
      }, connection);
      return result.insertId;
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && /mode_reference/.test(error.message)) {
      throw ApiError.conflict('This reference number has already been recorded for that payment method', {
        referenceNo: 'Duplicate transaction reference',
      });
    }
    throw error;
  }

  const payment = await findPayment(paymentId);
  const balance = await studentTermBalance(payment.studentId, termId);
  const sms = data.sendSms === false
    ? { queued: false, reason: 'Not requested' }
    : await queuePaymentConfirmation(payment, balance, user);
  return { payment, balance, sms };
}

export async function reversePayment(id, reason, user, context) {
  await withTransaction(async (connection) => {
    const row = await queryOne('SELECT id, status, receipt_no AS receiptNo, amount_paid AS amountPaid FROM fee_payments WHERE id = ? FOR UPDATE', [id], connection);
    if (!row) throw ApiError.notFound('Payment not found');
    if (row.status === 'reversed') throw ApiError.conflict('This payment has already been reversed');
    await query(
      `UPDATE fee_payments
          SET status = 'reversed', reversed_by = ?, reversed_at = NOW(), reversal_reason = ?
        WHERE id = ?`,
      [user.id, reason, id],
      connection,
    );
    await recordAudit({
      ...context,
      action: 'payment.reverse',
      targetTable: 'fee_payments',
      targetId: id,
      details: { receiptNo: row.receiptNo, amountPaid: Number(row.amountPaid), reason },
    }, connection);
  });
  const payment = await findPayment(id);
  const balance = await studentTermBalance(payment.studentId, payment.termId);
  return { payment, balance };
}

/** Everything the PDF receipt needs, loaded up-front. */
export async function getReceiptData(id, user) {
  const payment = await findPayment(id, user);
  const balance = await studentTermBalance(payment.studentId, payment.termId);
  return { payment, balance, printedBy: user.fullName };
}
