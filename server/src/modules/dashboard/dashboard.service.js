import { query, queryOne } from '../../config/db.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { round } from '../../utils/sql.js';
import { teacherClassIds } from '../academics/access.service.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { computeClassResults, findExam } from '../exams/exams.service.js';
import { computeTermBalances } from '../finance/balances.service.js';

async function latestExamWithMarks(statuses) {
  const row = await queryOne(
    `SELECT e.id FROM exams e
      WHERE e.status IN (${statuses.map(() => '?').join(', ')})
        AND EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.id)
      ORDER BY COALESCE(e.end_date, e.start_date, DATE(e.created_at)) DESC, e.id DESC
      LIMIT 1`,
    statuses,
  );
  return row ? findExam(row.id) : null;
}

/** Pass rate and mean average for an exam across the given classes (or every class with marks). */
async function examPerformance(exam, restrictToClassIds = null) {
  const rows = await query('SELECT DISTINCT class_id AS classId FROM marks WHERE exam_id = ?', [exam.id]);
  const classIds = rows.map((row) => row.classId).filter((id) => !restrictToClassIds || restrictToClassIds.includes(id));

  const byClass = [];
  for (const classId of classIds) {
    const results = await computeClassResults(exam, classId);
    if (results.statistics.ranked === 0) continue;
    byClass.push({
      classId,
      className: results.class.className,
      candidates: results.statistics.ranked,
      passed: results.statistics.passed,
      passRate: results.statistics.passRate,
      meanAverage: results.statistics.meanAverage,
    });
  }

  const candidates = byClass.reduce((sum, entry) => sum + entry.candidates, 0);
  const passed = byClass.reduce((sum, entry) => sum + entry.passed, 0);
  const weightedMean = byClass.reduce((sum, entry) => sum + entry.meanAverage * entry.candidates, 0);
  return {
    exam: { id: exam.id, name: exam.name, termName: exam.termName, yearLabel: exam.yearLabel, status: exam.status },
    candidates,
    passed,
    passRate: candidates ? round((passed / candidates) * 100, 1) : null,
    meanAverage: candidates ? round(weightedMean / candidates, 2) : null,
    byClass,
  };
}

async function feeSnapshot(term) {
  if (!term) return null;
  const [collected, today, balances] = await Promise.all([
    queryOne(
      `SELECT COALESCE(SUM(amount_paid), 0) AS amount, COUNT(*) AS payments
         FROM fee_payments WHERE term_id = ? AND status = 'confirmed'`,
      [term.id],
    ),
    queryOne(
      `SELECT COALESCE(SUM(amount_paid), 0) AS amount, COUNT(*) AS payments
         FROM fee_payments WHERE status = 'confirmed' AND payment_date = CURDATE()`,
    ),
    computeTermBalances(term.id),
  ]);
  // Expected = every billed student's term bill after discounts and optional-fee allocations.
  const expectedAmount = round(balances.reduce((sum, row) => sum + row.expected, 0));
  const collectedAmount = Number(collected.amount);
  return {
    termName: term.termName,
    expected: expectedAmount,
    collected: collectedAmount,
    outstanding: round(balances.reduce((sum, row) => sum + Math.max(0, row.balance), 0)),
    collectionRate: expectedAmount ? round((collectedAmount / expectedAmount) * 100, 1) : null,
    paymentsThisTerm: collected.payments,
    todayAmount: Number(today.amount),
    todayPayments: today.payments,
  };
}

/** Fee collection per class for the current term (Headmaster's class-by-class view). */
async function classFinance(term) {
  if (!term) return [];
  const balances = await computeTermBalances(term.id);
  const byClass = new Map();
  for (const row of balances) {
    const entry = byClass.get(row.classId) ?? { classId: row.classId, className: row.className, students: 0, expected: 0, collected: 0, outstanding: 0 };
    entry.students += 1;
    entry.expected += row.expected;
    entry.collected += row.paid;
    entry.outstanding += Math.max(0, row.balance);
    byClass.set(row.classId, entry);
  }
  return [...byClass.values()].map((entry) => ({
    ...entry,
    expected: round(entry.expected),
    collected: round(entry.collected),
    outstanding: round(entry.outstanding),
    collectionRate: entry.expected ? round((entry.collected / entry.expected) * 100, 1) : null,
  }));
}

/** Income vs expenses for the last `months` calendar months (Zanzibar time). */
async function monthlySeries(months = 6) {
  const today = todayInSchoolTz();
  const start = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  const from = start.toISOString().slice(0, 10);
  const [income, expenses] = await Promise.all([
    query(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount_paid) AS amount
         FROM fee_payments WHERE status = 'confirmed' AND payment_date >= ? GROUP BY DATE_FORMAT(payment_date, '%Y-%m')`,
      [from],
    ),
    query(
      `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS amount
         FROM expenses WHERE status = 'recorded' AND expense_date >= ? GROUP BY DATE_FORMAT(expense_date, '%Y-%m')`,
      [from],
    ),
  ]);
  const incomeMap = new Map(income.map((row) => [row.month, Number(row.amount)]));
  const expenseMap = new Map(expenses.map((row) => [row.month, Number(row.amount)]));
  const series = [];
  for (let i = 0; i < months; i += 1) {
    const date = new Date(start);
    date.setUTCMonth(start.getUTCMonth() + i);
    const month = date.toISOString().slice(0, 7);
    const monthIncome = incomeMap.get(month) ?? 0;
    const monthExpenses = expenseMap.get(month) ?? 0;
    series.push({ month, income: monthIncome, expenses: monthExpenses, net: round(monthIncome - monthExpenses) });
  }
  return series;
}

async function adminSummary(period) {
  const [counts, byClass, statusRows, latestExam, fees, finance] = await Promise.all([
    queryOne(
      `SELECT
         (SELECT COUNT(*) FROM students WHERE status = 'active') AS activeStudents,
         (SELECT COUNT(*) FROM students WHERE status = 'active' AND gender = 'male') AS maleStudents,
         (SELECT COUNT(*) FROM students WHERE status = 'active' AND gender = 'female') AS femaleStudents,
         (SELECT COUNT(*) FROM classes WHERE is_active = 1) AS activeClasses,
         (SELECT COUNT(*) FROM streams WHERE is_active = 1) AS activeStreams,
         (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND status = 'active') AS activeTeachers,
         (SELECT COUNT(*) FROM subjects WHERE is_active = 1) AS activeSubjects,
         (SELECT COUNT(*) FROM students WHERE admission_date >= ?) AS admissionsThisYear`,
      [period.academicYear?.startDate ?? '9999-12-31'],
    ),
    query(
      `SELECT c.id AS classId, c.class_name AS className, c.level, COUNT(s.id) AS students
         FROM classes c
         LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
        WHERE c.is_active = 1
        GROUP BY c.id, c.class_name, c.level, c.sort_order
        ORDER BY FIELD(c.level, 'nursery', 'primary', 'o_level', 'a_level'), c.sort_order, c.class_name`,
    ),
    query('SELECT status, COUNT(*) AS total FROM students GROUP BY status'),
    latestExamWithMarks(['open', 'closed', 'published']),
    feeSnapshot(period.term),
    classFinance(period.term),
  ]);
  return {
    metrics: counts,
    studentsByClass: byClass,
    statusBreakdown: Object.fromEntries(statusRows.map((row) => [row.status, row.total])),
    performance: latestExam ? await examPerformance(latestExam) : null,
    fees,
    classFinance: finance,
  };
}

async function teacherSummary(user, period) {
  const classIds = await teacherClassIds(user.id, period.academicYear?.id);
  const [assignments, classTeacherOf, studentCount, openExams, latestExam] = await Promise.all([
    period.academicYear
      ? query(
        `SELECT ta.id, sub.name AS subjectName, sub.code AS subjectCode, c.class_name AS className,
                st.stream_name AS streamName, ta.class_id AS classId, ta.stream_id AS streamId, ta.subject_id AS subjectId
           FROM teacher_assignments ta
           JOIN subjects sub ON sub.id = ta.subject_id
           JOIN classes c ON c.id = ta.class_id
           LEFT JOIN streams st ON st.id = ta.stream_id
          WHERE ta.teacher_id = ? AND ta.academic_year_id = ?
          ORDER BY c.sort_order, st.stream_name, sub.name`,
        [user.id, period.academicYear.id],
      )
      : [],
    query('SELECT id AS classId, class_name AS className FROM classes WHERE class_teacher_id = ?', [user.id]),
    classIds.length
      ? queryOne(
        `SELECT COUNT(*) AS total FROM students WHERE status = 'active' AND class_id IN (${classIds.map(() => '?').join(', ')})`,
        classIds,
      )
      : { total: 0 },
    query(
      `SELECT e.id, e.name, t.term_name AS termName FROM exams e JOIN terms t ON t.id = e.term_id
        WHERE e.status = 'open' ORDER BY e.id DESC`,
    ),
    latestExamWithMarks(['open', 'closed', 'published']),
  ]);

  // Marks still missing per (open exam × assignment): expected = active students in the class/stream.
  const pendingRows = await query(
    `SELECT e.id AS examId, e.name AS examName, ta.class_id AS classId, c.class_name AS className,
            ta.stream_id AS streamId, st.stream_name AS streamName, ta.subject_id AS subjectId, sub.name AS subjectName,
            (SELECT COUNT(*) FROM students s
              WHERE s.class_id = ta.class_id AND s.status = 'active' AND (ta.stream_id IS NULL OR s.stream_id = ta.stream_id)) AS expected,
            (SELECT COUNT(*) FROM marks m
              WHERE m.exam_id = e.id AND m.subject_id = ta.subject_id AND m.class_id = ta.class_id
                AND (ta.stream_id IS NULL OR m.stream_id = ta.stream_id)) AS entered
       FROM teacher_assignments ta
       JOIN exams e ON e.academic_year_id = ta.academic_year_id AND e.status = 'open'
       JOIN classes c ON c.id = ta.class_id
       JOIN subjects sub ON sub.id = ta.subject_id
       LEFT JOIN streams st ON st.id = ta.stream_id
      WHERE ta.teacher_id = ?
      ORDER BY e.id DESC, c.sort_order, st.stream_name, sub.name`,
    [user.id],
  );
  const pendingMarks = pendingRows
    .map((row) => ({ ...row, pending: Math.max(0, row.expected - row.entered) }))
    .filter((row) => row.pending > 0);

  // Group subject assignments into a class/stream grid with student counts.
  const groups = new Map();
  for (const assignment of assignments) {
    const key = `${assignment.classId}:${assignment.streamId ?? ''}`;
    const entry = groups.get(key) ?? {
      classId: assignment.classId, className: assignment.className, streamId: assignment.streamId, streamName: assignment.streamName, subjects: [],
    };
    entry.subjects.push({ subjectId: assignment.subjectId, name: assignment.subjectName, code: assignment.subjectCode });
    groups.set(key, entry);
  }
  const assignedClasses = await Promise.all([...groups.values()].map(async (entry) => {
    const { total } = await queryOne(
      `SELECT COUNT(*) AS total FROM students WHERE status = 'active' AND class_id = ? ${entry.streamId ? 'AND stream_id = ?' : ''}`,
      entry.streamId ? [entry.classId, entry.streamId] : [entry.classId],
    );
    return { ...entry, students: total, isClassTeacher: classTeacherOf.some((c) => c.classId === entry.classId) };
  }));

  return {
    metrics: {
      subjectAssignments: assignments.length,
      classesTaught: classIds.length,
      studentsTaught: studentCount.total,
      openExams: openExams.length,
      pendingMarks: pendingMarks.reduce((sum, row) => sum + row.pending, 0),
    },
    assignments,
    assignedClasses,
    pendingMarks,
    classTeacherOf,
    openExams,
    performance: latestExam && classIds.length ? await examPerformance(latestExam, classIds) : null,
  };
}

async function accountantSummary(period) {
  const monthStart = `${todayInSchoolTz().slice(0, 7)}-01`;
  const [counts, fees, monthly, monthTotals, recentPayments, defaulters] = await Promise.all([
    queryOne(`SELECT (SELECT COUNT(*) FROM students WHERE status = 'active') AS activeStudents,
                     (SELECT COUNT(*) FROM classes WHERE is_active = 1) AS activeClasses`),
    feeSnapshot(period.term),
    monthlySeries(6),
    queryOne(
      `SELECT
         (SELECT COALESCE(SUM(amount_paid), 0) FROM fee_payments WHERE status = 'confirmed' AND payment_date >= ?) AS income,
         (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status = 'recorded' AND expense_date >= ?) AS expenses`,
      [monthStart, monthStart],
    ),
    query(
      `SELECT fp.id, fp.receipt_no AS receiptNo, fp.amount_paid AS amountPaid, fp.payment_mode AS paymentMode,
              fp.payment_date AS paymentDate, fp.status, s.first_name AS firstName, s.last_name AS lastName
         FROM fee_payments fp JOIN students s ON s.id = fp.student_id
        ORDER BY fp.id DESC LIMIT 6`,
    ),
    period.term ? computeTermBalances(period.term.id) : Promise.resolve([]),
  ]);
  const owing = defaulters.filter((row) => row.balance > 0);
  return {
    metrics: counts,
    fees,
    monthly,
    thisMonth: { income: Number(monthTotals.income), expenses: Number(monthTotals.expenses) },
    unpaid: {
      students: owing.length,
      amount: round(owing.reduce((sum, row) => sum + row.balance, 0)),
      topDebtors: owing.sort((a, b) => b.balance - a.balance).slice(0, 5).map((row) => ({
        studentId: row.studentId, fullName: row.fullName, className: row.className, balance: row.balance,
      })),
    },
    recentPayments: recentPayments.map((row) => ({ ...row, amountPaid: Number(row.amountPaid), fullName: `${row.firstName} ${row.lastName}` })),
  };
}

async function parentSummary(user, period) {
  const children = await query(
    `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
            s.last_name AS lastName, s.status, c.class_name AS className, st.stream_name AS streamName
       FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN streams st ON st.id = s.stream_id
      WHERE s.parent_user_id = ?
      ORDER BY s.first_name`,
    [user.id],
  );
  const latestRows = children.length
    ? await query(
      `SELECT m.student_id AS studentId, e.id AS examId, e.name AS examName, t.term_name AS termName, ay.year_label AS yearLabel
         FROM marks m
         JOIN exams e ON e.id = m.exam_id AND e.status = 'published'
         JOIN terms t ON t.id = e.term_id
         JOIN academic_years ay ON ay.id = e.academic_year_id
        WHERE m.student_id IN (${children.map(() => '?').join(', ')})
        GROUP BY m.student_id, e.id, e.name, t.term_name, ay.year_label, ay.start_date, t.term_number
        ORDER BY ay.start_date DESC, t.term_number DESC, e.id DESC`,
      children.map((child) => child.id),
    )
    : [];
  const reportsByStudent = new Map();
  for (const row of latestRows) {
    const list = reportsByStudent.get(row.studentId) ?? [];
    if (list.length < 6) list.push(row);
    reportsByStudent.set(row.studentId, list);
  }

  const ids = children.map((child) => child.id);
  const [balances, payments] = await Promise.all([
    period.term && ids.length ? computeTermBalances(period.term.id, { studentIds: ids, statuses: null }) : Promise.resolve([]),
    ids.length
      ? query(
        `SELECT fp.id, fp.student_id AS studentId, fp.receipt_no AS receiptNo, fp.amount_paid AS amountPaid,
                fp.payment_mode AS paymentMode, fp.payment_date AS paymentDate, fp.status
           FROM fee_payments fp
          WHERE fp.student_id IN (${ids.map(() => '?').join(', ')})
          ORDER BY fp.payment_date DESC, fp.id DESC`,
        ids,
      )
      : Promise.resolve([]),
  ]);
  const balanceByStudent = new Map(balances.map((row) => [row.studentId, row]));
  const paymentsByStudent = new Map();
  for (const row of payments) {
    const list = paymentsByStudent.get(row.studentId) ?? [];
    if (list.length < 5) list.push({ ...row, amountPaid: Number(row.amountPaid) });
    paymentsByStudent.set(row.studentId, list);
  }

  const mapped = children.map((child) => {
    const balance = balanceByStudent.get(child.id);
    const reports = reportsByStudent.get(child.id) ?? [];
    return {
      ...child,
      fullName: [child.firstName, child.middleName, child.lastName].filter(Boolean).join(' '),
      latestReport: reports[0] ?? null,
      reports,
      payments: paymentsByStudent.get(child.id) ?? [],
      fees: balance
        ? { termName: period.term.termName, expected: balance.expected, paid: balance.paid, balance: balance.balance, discount: balance.discount }
        : null,
    };
  });
  return {
    metrics: {
      children: children.length,
      totalBalance: round(mapped.reduce((sum, child) => sum + Math.max(0, child.fees?.balance ?? 0), 0)),
    },
    children: mapped,
  };
}

export async function getSummary(user) {
  const period = await getCurrentPeriod();
  let summary;
  if (user.role === 'admin') summary = await adminSummary(period);
  else if (user.role === 'teacher') summary = await teacherSummary(user, period);
  else if (user.role === 'accountant') summary = await accountantSummary(period);
  else summary = await parentSummary(user, period);
  return { role: user.role, period, ...summary };
}
