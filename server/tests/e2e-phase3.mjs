// Phase 3 end-to-end: finance + SMS against throwaway MySQL (3307) and a mock Beem gateway.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const serverDir = process.argv[2];
const scratch = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- mock Beem -----------------------------------------------------------
const mock = { requests: [], failAll: false, authOk: 0, authBad: 0 };
const expectedAuth = `Basic ${Buffer.from('test-api-key:test-secret').toString('base64')}`;
const beem = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (req.headers.authorization === expectedAuth) mock.authOk += 1; else mock.authBad += 1;
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url === '/balance') return res.end(JSON.stringify({ data: { credit_balance: 4321 } }));
    if (req.method === 'POST' && req.url === '/v1/send') {
      const payload = JSON.parse(body);
      mock.requests.push(payload);
      const bad = mock.failAll || payload.recipients.some((r) => r.dest_addr === '255711000000');
      if (bad) {
        res.statusCode = mock.failAll ? 503 : 200;
        return res.end(JSON.stringify({ successful: false, code: 102, message: mock.failAll ? 'Service unavailable' : 'Insufficient balance' }));
      }
      return res.end(JSON.stringify({ successful: true, request_id: 9000 + mock.requests.length, code: 100, message: 'Message Submitted Successfully', valid: payload.recipients.length, invalid: 0, duplicates: 0 }));
    }
    res.statusCode = 404;
    return res.end('{}');
  });
});
await new Promise((r) => beem.listen(0, '127.0.0.1', r));
const beemBase = `http://127.0.0.1:${beem.address().port}`;

Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_p3_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173',
  COOKIE_SECURE: 'false', SCHOOL_NAME: 'Al-Noor Academy Zanzibar', SCHOOL_ADDRESS: 'P.O. Box 1234, Zanzibar',
  SCHOOL_PHONE: '+255 24 223 0000', SCHOOL_EMAIL: 'info@alnoor.ac.tz', SCHOOL_MOTTO: 'Knowledge is Light',
  SCHOOL_REGISTRATION_NO: 'ZEC/PS/0142', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000',
  BEEM_API_KEY: 'test-api-key', BEEM_SECRET_KEY: 'test-secret', BEEM_SENDER_ID: 'ALNOOR',
  BEEM_BASE_URL: `${beemBase}/v1/send`, BEEM_BALANCE_URL: `${beemBase}/balance`,
});
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });

let passed = 0;
let failed = 0;
function check(name, condition, extra) {
  if (condition) passed += 1;
  else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); }
}

const migrateOut = run('src/scripts/migrate.js');
check('migration 003 applied', migrateOut.includes('003_phase3_finance'), migrateOut);
check('migrate idempotent', run('src/scripts/migrate.js').includes('No pending migrations'));
const adminTemp = run('src/scripts/createAdmin.js', ['--name', 'Head Master', '--email', 'head@alnoor.ac.tz']).match(/Temporary password: (\S+)/)[1];

const { default: app } = await import(`file:///${serverDir}/src/app.js`);
const { closePool } = await import(`file:///${serverDir}/src/config/db.js`);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

function session() {
  let cookie = '';
  const call = async (method, url, body, { raw = false } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
    return { status: res.status, ...(await res.json()) };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b ?? {}), put: (u, b) => call('PUT', u, b), del: (u) => call('DELETE', u), raw: (u) => call('GET', u, null, { raw: true }) };
}
async function signIn(identifier, temp, finalPassword) {
  const s = session();
  await s.post('/auth/login', { identifier, password: temp });
  await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword });
  return s;
}
async function waitForBatch(s, batchId) {
  for (let i = 0; i < 60; i += 1) {
    const r = await s.get(`/sms/logs?batchId=${batchId}&pageSize=200`);
    if (r.data.items.length && !r.data.items.some((l) => l.status === 'queued')) return r.data.items;
    await sleep(100);
  }
  throw new Error(`batch ${batchId} never finished`);
}

const admin = await signIn('head@alnoor.ac.tz', adminTemp, 'Headmaster#2026');
let r;

// ---- setup
r = await admin.post('/academics/years', { yearLabel: '2026', startDate: '2026-01-05', endDate: '2026-12-11' });
const yearId = r.data.id;
r = await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: '2026-01-05', endDate: '2026-12-01' });
const termId = r.data.id;
r = await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term II', termNumber: 2, startDate: '2026-12-02', endDate: '2026-12-11' });
const term2Id = r.data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
r = await admin.post('/academics/classes', { className: 'Form One', code: 'F1', level: 'o_level' });
const classId = r.data.id;
r = await admin.post('/academics/streams', { classId, streamName: 'A', code: 'F1A' });
const streamA = r.data.id;
r = await admin.post('/academics/classes', { className: 'Form Two', code: 'F2', level: 'o_level' });
const class2Id = r.data.id;

r = await admin.post('/users', { fullName: 'Fatma Bursar', email: 'bursar@alnoor.ac.tz', role: 'accountant' });
const accountant = await signIn('bursar@alnoor.ac.tz', r.data.temporaryPassword, 'Bursar#2026zz');
r = await admin.post('/users', { fullName: 'Mzee Bakari', phone: '0777 444 555', role: 'parent' });
const parentId = r.data.user.id;
const parent = await signIn('0777444555', r.data.temporaryPassword, 'Parent#2026x');
r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@alnoor.ac.tz', role: 'teacher' });
const teacher = await signIn('asha@alnoor.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');

const studentDefs = [
  ['Amina', 'Said', 'female', '0777444555', parentId],
  ['Juma', 'Ali', 'male', '0655123456', null],
  ['Salim', 'Othman', 'male', '0711000000', null],
];
const sids = [];
for (const [firstName, lastName, gender, parentPhone, parentUserId] of studentDefs) {
  r = await admin.post('/students', { firstName, lastName, gender, dob: '2012-03-14', classId, streamId: streamA, parentName: `Parent of ${firstName}`, parentPhone, parentUserId, admissionDate: '2026-01-06' });
  sids.push(r.data.id);
}
r = await admin.post('/students', { firstName: 'Other', lastName: 'Kid', gender: 'male', dob: '2011-01-01', classId: class2Id, parentName: 'Other Parent', parentPhone: '0688999000', admissionDate: '2026-01-06' });
const otherClassStudent = r.data.id;

// ---- fee types & structures
r = await accountant.post('/finance/fee-types', { name: 'Tuition Fee', code: 'tuition' });
check('create fee type', r.status === 201 && r.data.code === 'TUITION', r);
const tuition = r.data.id;
const exam = (await accountant.post('/finance/fee-types', { name: 'Examination Fee', code: 'EXAM' })).data.id;
const transport = (await accountant.post('/finance/fee-types', { name: 'Transport', code: 'TRANS' })).data.id;
r = await accountant.post('/finance/fee-types', { name: 'Tuition Fee', code: 'TUI2' });
check('duplicate fee type 409', r.status === 409, r);
r = await teacher.get('/finance/fee-types');
check('teacher blocked from finance', r.status === 403, r);

r = await accountant.post('/finance/fee-structures', { feeTypeId: tuition, termId, amount: 500000, classIds: [classId, class2Id] });
check('structure for two classes', r.status === 201 && r.data.length === 2, r);
await accountant.post('/finance/fee-structures', { feeTypeId: exam, termId, amount: 50000, classIds: [classId] });
r = await accountant.post('/finance/fee-structures', { feeTypeId: transport, termId, amount: 120000, classIds: [classId], isMandatory: false });
const transportStructure = r.data[0].id;
r = await accountant.post('/finance/fee-structures', { feeTypeId: tuition, termId, amount: 1, classIds: [classId] });
check('duplicate structure 409', r.status === 409, r);
r = await accountant.get('/finance/fee-structures');
check('list structures defaults to current term', r.data.termId === termId && r.data.items.length === 4, r.data);
r = await accountant.post('/finance/fee-structures/copy', { fromTermId: termId, toTermId: term2Id });
check('copy structures', r.data.copied === 4, r);
r = await accountant.post('/finance/fee-structures/copy', { fromTermId: termId, toTermId: term2Id });
check('copy idempotent', r.data.copied === 0, r);

r = await accountant.put(`/finance/fee-structures/${transportStructure}/allocations`, { studentIds: [sids[0]] });
check('allocate optional fee', r.data.added === 1, r);
r = await accountant.get(`/finance/fee-structures/${transportStructure}/allocations`);
check('allocation list', r.data.students.find((s) => s.studentId === sids[0]).allocated === true && r.data.students.length === 3, r.data);
r = await accountant.put(`/finance/fee-structures/${transportStructure}/allocations`, { studentIds: [otherClassStudent] });
check('allocation class check', r.status === 400, r);

// ---- discounts
r = await accountant.post('/finance/discounts', { studentId: sids[1], termId, discountType: 'percentage', value: 10, feeTypeId: tuition, reason: 'Sibling discount' });
check('accountant cannot grant discount', r.status === 403, r);
r = await admin.post('/finance/discounts', { studentId: sids[1], termId, discountType: 'percentage', value: 10, feeTypeId: tuition, reason: 'Sibling discount' });
check('grant percentage discount', r.status === 201, r);
r = await admin.post('/finance/discounts', { studentId: sids[2], termId, discountType: 'percentage', value: 150, reason: 'Too much' });
check('percentage > 100 rejected', r.status === 400, r);
r = await admin.post('/finance/discounts', { studentId: sids[2], termId, discountType: 'fixed', value: 100000, reason: 'Staff child' });
const fixedDiscountId = r.data.id;

r = await accountant.get(`/finance/students/${sids[0]}/statement`);
check('statement A (mandatory + optional)', r.data.balance.gross === 670000 && r.data.balance.balance === 670000 && r.data.balance.items.length === 3, r.data.balance);
r = await accountant.get(`/finance/students/${sids[1]}/statement`);
check('statement B (10% tuition)', r.data.balance.discount === 50000 && r.data.balance.expected === 500000, r.data.balance);
r = await accountant.get(`/finance/students/${sids[2]}/statement`);
check('statement C (fixed)', r.data.balance.expected === 450000, r.data.balance);

// ---- payments
r = await accountant.post('/finance/payments', { studentId: sids[0], amountPaid: 200000, paymentMode: 'bank_transfer', referenceNo: 'crdb-778899', feeTypeId: tuition });
check('record payment', r.status === 201 && r.data.payment.receiptNo === 'RCT-2026-0001' && r.data.balance.balance === 470000 && r.data.sms.queued, r);
const payment1 = r.data.payment.id;
await sleep(400);
const confirmation = mock.requests.find((p) => p.message.includes('RCT-2026-0001'));
check('confirmation SMS sent to Beem', confirmation && confirmation.source_addr === 'ALNOOR' && confirmation.recipients[0].dest_addr === '255777444555'
  && confirmation.message.includes('TZS 200,000') && confirmation.message.includes('Salio la Term I 2026: TZS 470,000') && confirmation.encoding === 0, confirmation);
check('Basic auth header', mock.authOk > 0 && mock.authBad === 0, mock);
r = await accountant.get('/sms/logs?category=payment_receipt');
check('confirmation logged as sent', r.data.items[0]?.status === 'sent' && r.data.items[0].providerRequestId, r.data.items[0]);

r = await accountant.post('/finance/payments', { studentId: sids[0], amountPaid: 50000, paymentMode: 'cash', sendSms: false });
check('cash payment without reference', r.status === 201 && r.data.payment.receiptNo === 'RCT-2026-0002' && r.data.sms.queued === false, r);
const payment2 = r.data.payment.id;
// References are optional now (the receipt number is used when none is given — see phase 7).
r = await accountant.post('/finance/payments', { studentId: sids[0], amountPaid: 0, paymentMode: 'mobile_money' });
check('zero amount rejected', r.status === 400 && r.error.details.amountPaid, r);
r = await accountant.post('/finance/payments', { studentId: sids[1], amountPaid: 10000, paymentMode: 'bank_transfer', referenceNo: 'CRDB-778899' });
check('duplicate reference 409', r.status === 409, r);
r = await accountant.post('/finance/payments', { studentId: sids[1], amountPaid: 10000, paymentMode: 'cash', paymentDate: '2099-01-01' });
check('future date rejected', r.status === 400, r);
r = await accountant.post('/finance/payments', { studentId: sids[2], amountPaid: 100000, paymentMode: 'mobile_money', referenceNo: 'MP12345' });
const payment3 = r.data.payment.id;
await sleep(400);
r = await accountant.get(`/sms/logs?status=failed&search=255711000000`);
check('gateway rejection logged as failed', r.data.items.length === 1 && r.data.items[0].errorMessage.includes('Insufficient'), r.data.items);
r = await teacher.post('/finance/payments', { studentId: sids[0], amountPaid: 1, paymentMode: 'cash' });
check('teacher cannot record payment', r.status === 403, r);

r = await accountant.post(`/finance/payments/${payment2}/reverse`, {});
check('reversal needs reason', r.status === 400, r);
r = await accountant.post(`/finance/payments/${payment2}/reverse`, { reason: 'Recorded twice by mistake' });
check('reverse payment', r.data.payment.status === 'reversed' && r.data.balance.balance === 470000, r.data);
r = await accountant.post(`/finance/payments/${payment2}/reverse`, { reason: 'again please' });
check('double reversal 409', r.status === 409, r);
r = await accountant.get('/finance/payments');
check('payments list totals', r.data.totals.confirmedAmount === 300000 && r.data.totals.reversedAmount === 50000, r.data.totals);
r = await accountant.get('/finance/payments?search=RCT-2026-0003');
check('payments search', r.data.items.length === 1 && r.data.items[0].id === payment3, r.data);

r = await accountant.raw(`/finance/payments/${payment1}/receipt-pdf`);
check('receipt pdf', r.status === 200 && r.buffer.subarray(0, 4).toString() === '%PDF', r.status);
writeFileSync(path.join(scratch, 'receipt.pdf'), r.buffer);
r = await accountant.raw(`/finance/payments/${payment2}/receipt-pdf`);
writeFileSync(path.join(scratch, 'receipt-reversed.pdf'), r.buffer);
r = await parent.raw(`/finance/payments/${payment1}/receipt-pdf`);
check('parent downloads own receipt', r.status === 200, r.status);
r = await parent.raw(`/finance/payments/${payment3}/receipt-pdf`);
check('parent blocked from other receipt', r.status === 404, r.status);
r = await parent.get(`/finance/students/${sids[0]}/statement`);
check('parent statement own child', r.status === 200 && r.data.payments.length === 2, r);
r = await parent.get(`/finance/students/${sids[1]}/statement`);
check('parent statement other child 404', r.status === 404, r);

// ---- defaulters
r = await accountant.get('/finance/defaulters');
check('defaulters sorted', r.data.items.length === 4 && r.data.items[0].balance === 500000 && r.data.totals.totalDebt === 470000 + 500000 + 350000 + 500000, r.data);
r = await accountant.get(`/finance/defaulters?classId=${classId}&minBalance=480000`);
check('defaulters filters', r.data.items.length === 1 && r.data.items[0].studentId === sids[1], r.data.items);

// ---- SMS broadcast
r = await accountant.post('/sms/preview', { target: { type: 'defaulters', classId }, message: 'Dear {parent_name}, {student_name} has a balance of {balance} for {term}. {school}' });
check('preview defaulters', r.data.recipients === 3 && r.data.samples[0].message.includes('TZS') && r.data.totalSegments >= 3, r.data);
r = await accountant.post('/sms/preview', { target: { type: 'all_parents' }, message: 'Hello {unknown_field}' });
check('unknown placeholder rejected', r.status === 400, r);
r = await accountant.post('/sms/preview', { target: { type: 'custom', phones: ['0777 444 555', '+255777444555', '12345'] }, message: 'School closes Friday.' });
check('custom dedupe + invalid', r.data.recipients === 1 && r.data.invalidPhones === 1, r.data);
r = await accountant.post('/sms/preview', { target: { type: 'all_parents' }, message: 'Habari ✓ unicode' });
check('UCS-2 detection', r.data.encoding === 'UCS-2', r.data);

const before = mock.requests.length;
r = await accountant.post('/sms/send-bulk', { target: { type: 'defaulters', classId }, message: 'Dear {parent_name}, {student_name} owes {balance}.' });
check('send-bulk queued', r.status === 202 && r.data.total === 3, r);
let logs = await waitForBatch(accountant, r.data.batchId);
check('bulk results', logs.filter((l) => l.status === 'sent').length === 2 && logs.filter((l) => l.status === 'failed').length === 1, logs.map((l) => l.status));
check('personalised messages reached Beem', mock.requests.slice(before).some((p) => p.message.includes('Juma Ali owes TZS 500,000')), mock.requests.slice(before));

mock.failAll = true;
r = await accountant.post('/sms/send-bulk', { target: { type: 'students', studentIds: [sids[0], sids[1]] }, message: 'Meeting on Saturday at 9am.' });
logs = await waitForBatch(accountant, r.data.batchId);
check('outage logged as failed', logs.every((l) => l.status === 'failed' && l.errorMessage.includes('Gateway error')), logs);
check('one request for identical text', mock.requests.at(-1).recipients.length === 2, mock.requests.at(-1));
mock.failAll = false;
r = await accountant.post('/sms/retry', { ids: logs.map((l) => l.id) });
check('retry queued', r.status === 202 && r.data.queued === 2, r);
const retried = await waitForBatch(accountant, r.data.batchId);
check('retry sent with lineage', retried.every((l) => l.status === 'sent' && l.retryOf), retried);
r = await accountant.post('/sms/send-bulk', { target: { type: 'exam_results', examId: 1, classId }, message: 'Results out' });
check('accountant cannot send results', r.status === 403 || r.status === 404, r);
r = await accountant.get('/sms/balance');
check('beem balance', r.data.creditBalance === 4321 && r.data.configured, r.data);
r = await accountant.get('/sms/logs?status=failed');
check('logs status filter + counts', r.data.items.every((l) => l.status === 'failed') && r.data.statusCounts.failed.total >= 1, r.data.statusCounts);
r = await teacher.get('/sms/logs');
check('teacher blocked from SMS', r.status === 403, r);

// ---- exam results SMS (Phase 2 integration)
const math = (await admin.post('/academics/subjects', { name: 'Mathematics', code: 'MATH', level: 'o_level' })).data.id;
const examId = (await admin.post('/exams', { name: 'Midterm', examType: 'midterm', termId })).data.id;
await admin.put(`/exams/${examId}`, { status: 'open' });
await admin.post('/exams/marks/bulk', { examId, subjectId: math, classId, entries: sids.map((id, i) => ({ studentId: id, score: [88, 61, 40][i] })) });
r = await admin.post('/sms/preview', { target: { type: 'exam_results', examId, classId }, message: '{student_name}: {exam} average {average}, grade {grade}, position {position}.' });
check('results SMS requires published exam', r.status === 409, r);
await admin.put(`/exams/${examId}`, { status: 'closed' });
await admin.put(`/exams/${examId}`, { status: 'published' });
r = await admin.post('/sms/preview', { target: { type: 'exam_results', examId, classId }, message: '{student_name}: {exam} average {average}, grade {grade}, position {position}.' });
check('results SMS personalised', r.data.recipients === 3 && r.data.samples[0].message.includes('position 1/3') && r.data.samples[0].message.includes('88%'), r.data);

// ---- expenses
r = await accountant.post('/finance/expenses', { category: 'utilities', description: 'ZECO electricity bill', amount: 350000, paymentMode: 'bank_transfer', referenceNo: 'ZECO-01', payee: 'ZECO' });
check('create expense', r.status === 201 && r.data.expenseNo === 'EXP-2026-0001', r);
const expense1 = r.data.id;
await accountant.post('/finance/expenses', { category: 'supplies', description: 'Chalk and markers', amount: 80000, paymentMode: 'cash' });
r = await accountant.post('/finance/expenses', { category: 'unknown', description: 'x', amount: 0, paymentMode: 'cash' });
check('expense validation', r.status === 400 && r.error.details.category && r.error.details.amount, r);
r = await accountant.get('/finance/expenses');
check('expense breakdown', r.data.totalRecorded === 430000 && r.data.breakdown.length === 2, r.data);
r = await accountant.post(`/finance/expenses/${expense1}/void`, { reason: 'Duplicate entry' });
check('void expense', r.data.status === 'voided', r);
r = await accountant.post(`/finance/expenses/${expense1}/void`, { reason: 'Duplicate entry' });
check('double void 409', r.status === 409, r);

// ---- reports
r = await accountant.get('/finance/overview');
check('overview', r.data.collected === 300000 && r.data.expenses === 80000 && r.data.net === 220000 && r.data.last14Days.length === 14
  && r.data.outstanding === 1820000 && r.data.defaulters === 4, r.data);
r = await accountant.get('/finance/summary?dateFrom=2026-01-01&dateTo=2026-12-31');
check('summary', r.data.income.total === 300000 && r.data.expenses.total === 80000 && r.data.net === 220000 && r.data.monthly.length >= 1, r.data);
r = await admin.get(`/students/${sids[1]}`);
check('profile uses discounts', r.data.fees.currentTerm.discount === 50000 && r.data.fees.currentTerm.expected === 500000, r.data.fees.currentTerm);
r = await admin.get('/dashboard/summary');
check('dashboard expected uses balances', r.data.fees.expected === 670000 + 500000 + 450000 + 500000 && r.data.fees.outstanding === 1820000, r.data.fees);

r = await admin.post(`/finance/discounts/${fixedDiscountId}/revoke`, { reason: 'No longer eligible' });
check('revoke discount', r.data.status === 'revoked', r);
r = await accountant.get(`/finance/students/${sids[2]}/statement`);
check('balance after revoke', r.data.balance.expected === 550000 && r.data.balance.balance === 450000, r.data.balance);
r = await accountant.del(`/finance/fee-structures/${transportStructure}`);
check('structure with allocations protected', r.status === 409, r);

console.log(`\n${passed} passed, ${failed} failed`);
server.close();
beem.close();
await closePool();
process.exit(failed ? 1 : 0);
