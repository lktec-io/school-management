import env from '../../config/env.js';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { paginated } from '../../utils/pagination.js';
import { nextSequenceValue } from '../../utils/sequences.js';
import { likeContains, withNumbers } from '../../utils/sql.js';

export const EXPENSE_CATEGORIES = ['salaries', 'utilities', 'maintenance', 'supplies', 'transport', 'examinations', 'other'];

const EXPENSE_SELECT = `SELECT e.id, e.expense_no AS expenseNo, e.category, e.description, e.payee, e.amount,
    e.expense_date AS expenseDate, e.payment_mode AS paymentMode, e.reference_no AS referenceNo, e.status,
    ru.full_name AS recordedByName, e.created_at AS createdAt,
    vu.full_name AS voidedByName, e.voided_at AS voidedAt, e.void_reason AS voidReason
  FROM expenses e
  JOIN users ru ON ru.id = e.recorded_by
  LEFT JOIN users vu ON vu.id = e.voided_by`;

async function findExpense(id) {
  const row = await queryOne(`${EXPENSE_SELECT} WHERE e.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Expense not found');
  return withNumbers(row, ['amount']);
}

function buildFilters(filters) {
  const where = [];
  const params = [];
  if (filters.category) {
    where.push('e.category = ?');
    params.push(filters.category);
  }
  if (filters.status) {
    where.push('e.status = ?');
    params.push(filters.status);
  }
  if (filters.dateFrom) {
    where.push('e.expense_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where.push('e.expense_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.search) {
    const term = likeContains(filters.search);
    where.push('(e.expense_no LIKE ? OR e.description LIKE ? OR e.payee LIKE ? OR e.reference_no LIKE ?)');
    params.push(term, term, term, term);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function listExpenses(filters, pagination) {
  const { whereSql, params } = buildFilters(filters);
  const [{ total }, rows, byCategory] = await Promise.all([
    queryOne(`SELECT COUNT(*) AS total FROM expenses e ${whereSql}`, params),
    query(`${EXPENSE_SELECT} ${whereSql} ORDER BY e.expense_date DESC, e.id DESC LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`, params),
    query(
      `SELECT e.category, COUNT(*) AS entries, SUM(e.amount) AS amount
         FROM expenses e ${whereSql ? `${whereSql} AND` : 'WHERE'} e.status = 'recorded'
        GROUP BY e.category ORDER BY amount DESC`,
      params,
    ),
  ]);
  const categories = withNumbers(byCategory, ['amount']);
  return {
    ...paginated(withNumbers(rows, ['amount']), total, pagination),
    breakdown: categories,
    totalRecorded: categories.reduce((sum, row) => sum + row.amount, 0),
  };
}

export async function createExpense(data, user, context) {
  const expenseDate = data.expenseDate ?? todayInSchoolTz();
  const year = expenseDate.slice(0, 4);
  const id = await withTransaction(async (connection) => {
    const sequence = await nextSequenceValue(connection, `EXPENSE-${year}`);
    const expenseNo = `${env.finance.expensePrefix}-${year}-${String(sequence).padStart(4, '0')}`;
    const result = await query(
      `INSERT INTO expenses (expense_no, category, description, payee, amount, expense_date, payment_mode, reference_no, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expenseNo, data.category, data.description, data.payee ?? null, data.amount, expenseDate, data.paymentMode,
        data.referenceNo ?? null, user.id],
      connection,
    );
    await recordAudit({
      ...context, action: 'expense.create', targetTable: 'expenses', targetId: result.insertId, details: { expenseNo, ...data, expenseDate },
    }, connection);
    return result.insertId;
  });
  return findExpense(id);
}

export async function voidExpense(id, reason, user, context) {
  await withTransaction(async (connection) => {
    const row = await queryOne('SELECT id, status, expense_no AS expenseNo, amount FROM expenses WHERE id = ? FOR UPDATE', [id], connection);
    if (!row) throw ApiError.notFound('Expense not found');
    if (row.status === 'voided') throw ApiError.conflict('This expense has already been voided');
    await query(
      "UPDATE expenses SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ? WHERE id = ?",
      [user.id, reason, id],
      connection,
    );
    await recordAudit({
      ...context, action: 'expense.void', targetTable: 'expenses', targetId: id, details: { expenseNo: row.expenseNo, amount: Number(row.amount), reason },
    }, connection);
  });
  return findExpense(id);
}
