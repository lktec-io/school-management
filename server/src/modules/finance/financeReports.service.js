import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { round, withNumbers } from '../../utils/sql.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { computeTermBalances, findTerm } from './balances.service.js';

async function resolveTerm(termId) {
  if (termId) return findTerm(termId);
  const { term } = await getCurrentPeriod();
  if (!term) throw ApiError.badRequest('No current term is set. Choose a term.');
  return findTerm(term.id);
}

/** Students with an unpaid balance for a term, largest debt first. */
export async function getDefaulters({ termId, classId, streamId, minBalance = 0, search }, { page, pageSize }) {
  const term = await resolveTerm(termId);
  const balances = await computeTermBalances(term.id, { classId, streamId, search });
  const threshold = Math.max(Number(minBalance) || 0, 0.01);
  const defaulters = balances
    .filter((row) => row.balance >= threshold)
    .sort((a, b) => b.balance - a.balance || a.fullName.localeCompare(b.fullName));

  const totals = defaulters.reduce((acc, row) => ({
    students: acc.students + 1,
    totalDebt: round(acc.totalDebt + row.balance),
    totalExpected: round(acc.totalExpected + row.expected),
    totalPaid: round(acc.totalPaid + row.paid),
  }), { students: 0, totalDebt: 0, totalExpected: 0, totalPaid: 0 });

  const start = (page - 1) * pageSize;
  return {
    term,
    items: defaulters.slice(start, start + pageSize).map(({ items, discounts, ...row }) => ({
      ...row,
      itemsCount: items.length,
      discountsCount: discounts.length,
    })),
    allStudentIds: defaulters.map((row) => row.studentId),
    totals,
    pagination: { page, pageSize, total: defaulters.length, totalPages: Math.max(1, Math.ceil(defaulters.length / pageSize)) },
  };
}

/** Finance dashboard figures for the current term. */
export async function getOverview() {
  const { term: current } = await getCurrentPeriod();
  const term = current ? await findTerm(current.id) : null;
  const today = todayInSchoolTz();
  const fourteenDaysAgo = new Date(`${today}T12:00:00Z`);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);
  const seriesStart = fourteenDaysAgo.toISOString().slice(0, 10);

  const [daily, todayRow, recent] = await Promise.all([
    query(
      `SELECT payment_date AS date, SUM(amount_paid) AS amount, COUNT(*) AS payments
         FROM fee_payments WHERE status = 'confirmed' AND payment_date BETWEEN ? AND ?
        GROUP BY payment_date ORDER BY payment_date`,
      [seriesStart, today],
    ),
    queryOne(
      `SELECT COALESCE(SUM(amount_paid), 0) AS amount, COUNT(*) AS payments
         FROM fee_payments WHERE status = 'confirmed' AND payment_date = ?`,
      [today],
    ),
    query(
      `SELECT fp.id, fp.receipt_no AS receiptNo, fp.amount_paid AS amountPaid, fp.payment_mode AS paymentMode,
              fp.payment_date AS paymentDate, fp.status, s.first_name AS firstName, s.last_name AS lastName,
              s.registration_number AS registrationNumber
         FROM fee_payments fp JOIN students s ON s.id = fp.student_id
        ORDER BY fp.id DESC LIMIT 8`,
    ),
  ]);

  const dailyMap = new Map(withNumbers(daily, ['amount']).map((row) => [row.date, row]));
  const last14Days = [];
  for (let i = 0; i < 14; i += 1) {
    const date = new Date(`${seriesStart}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    last14Days.push({ date: key, amount: dailyMap.get(key)?.amount ?? 0, payments: dailyMap.get(key)?.payments ?? 0 });
  }

  const base = {
    today: { amount: Number(todayRow.amount), payments: todayRow.payments },
    last14Days,
    recentPayments: withNumbers(recent, ['amountPaid']).map((row) => ({ ...row, fullName: `${row.firstName} ${row.lastName}` })),
  };
  if (!term) return { term: null, ...base };

  const [balances, collected, expenses, byMode] = await Promise.all([
    computeTermBalances(term.id),
    queryOne(
      `SELECT COALESCE(SUM(amount_paid), 0) AS amount, COUNT(*) AS payments
         FROM fee_payments WHERE term_id = ? AND status = 'confirmed'`,
      [term.id],
    ),
    queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS entries
         FROM expenses WHERE status = 'recorded' AND expense_date BETWEEN ? AND ?`,
      [term.startDate, term.endDate],
    ),
    query(
      `SELECT payment_mode AS paymentMode, SUM(amount_paid) AS amount, COUNT(*) AS payments
         FROM fee_payments WHERE term_id = ? AND status = 'confirmed'
        GROUP BY payment_mode ORDER BY amount DESC`,
      [term.id],
    ),
  ]);

  const expected = round(balances.reduce((sum, row) => sum + row.expected, 0));
  const outstanding = round(balances.reduce((sum, row) => sum + Math.max(0, row.balance), 0));
  const collectedAmount = Number(collected.amount);
  const expenseAmount = Number(expenses.amount);
  return {
    term: { ...term },
    ...base,
    expected,
    collected: collectedAmount,
    paymentsThisTerm: collected.payments,
    outstanding,
    defaulters: balances.filter((row) => row.balance > 0).length,
    studentsBilled: balances.filter((row) => row.expected > 0).length,
    collectionRate: expected ? round((collectedAmount / expected) * 100, 1) : null,
    expenses: expenseAmount,
    expenseEntries: expenses.entries,
    net: round(collectedAmount - expenseAmount),
    byMode: withNumbers(byMode, ['amount']),
  };
}

/** Income vs expenditure for a date range (defaults to the current term, else the current month). */
export async function getSummary({ dateFrom, dateTo }) {
  let from = dateFrom;
  let to = dateTo;
  if (!from || !to) {
    const { term } = await getCurrentPeriod();
    const today = todayInSchoolTz();
    from = from || term?.startDate || `${today.slice(0, 7)}-01`;
    to = to || term?.endDate || today;
  }
  if (from > to) throw ApiError.badRequest('The start date must be before the end date');

  const [incomeByMode, incomeByType, incomeMonthly, expenseByCategory, expenseMonthly] = await Promise.all([
    query(
      `SELECT payment_mode AS paymentMode, SUM(amount_paid) AS amount, COUNT(*) AS entries
         FROM fee_payments WHERE status = 'confirmed' AND payment_date BETWEEN ? AND ?
        GROUP BY payment_mode ORDER BY amount DESC`,
      [from, to],
    ),
    query(
      `SELECT COALESCE(ft.name, 'General fees') AS feeTypeName, SUM(fp.amount_paid) AS amount, COUNT(*) AS entries
         FROM fee_payments fp LEFT JOIN fee_types ft ON ft.id = fp.fee_type_id
        WHERE fp.status = 'confirmed' AND fp.payment_date BETWEEN ? AND ?
        GROUP BY COALESCE(ft.name, 'General fees') ORDER BY amount DESC`,
      [from, to],
    ),
    query(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount_paid) AS amount
         FROM fee_payments WHERE status = 'confirmed' AND payment_date BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(payment_date, '%Y-%m')`,
      [from, to],
    ),
    query(
      `SELECT category, SUM(amount) AS amount, COUNT(*) AS entries
         FROM expenses WHERE status = 'recorded' AND expense_date BETWEEN ? AND ?
        GROUP BY category ORDER BY amount DESC`,
      [from, to],
    ),
    query(
      `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS amount
         FROM expenses WHERE status = 'recorded' AND expense_date BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(expense_date, '%Y-%m')`,
      [from, to],
    ),
  ]);

  const months = new Map();
  for (const row of withNumbers(incomeMonthly, ['amount'])) months.set(row.month, { month: row.month, income: row.amount, expenses: 0 });
  for (const row of withNumbers(expenseMonthly, ['amount'])) {
    const entry = months.get(row.month) ?? { month: row.month, income: 0, expenses: 0 };
    entry.expenses = row.amount;
    months.set(row.month, entry);
  }
  const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({ ...row, net: round(row.income - row.expenses) }));

  const byMode = withNumbers(incomeByMode, ['amount']);
  const byCategory = withNumbers(expenseByCategory, ['amount']);
  const income = round(byMode.reduce((sum, row) => sum + row.amount, 0));
  const expenses = round(byCategory.reduce((sum, row) => sum + row.amount, 0));
  return {
    dateFrom: from,
    dateTo: to,
    income: { total: income, byMode, byFeeType: withNumbers(incomeByType, ['amount']) },
    expenses: { total: expenses, byCategory },
    net: round(income - expenses),
    monthly,
  };
}
