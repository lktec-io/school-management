// Phase 4/5 end-to-end: settings, branding, audit trail, backups, role dashboards.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const serverDir = process.argv[2];
const scratch = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const storageDir = path.join(scratch, 'p5-storage');
const backupDir = path.join(storageDir, 'backups');
rmSync(storageDir, { recursive: true, force: true });
mkdirSync(backupDir, { recursive: true });
const MYSQLDUMP = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';
const DB_NAME = `sms_p5_${Date.now()}`;

Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173', COOKIE_SECURE: 'false',
  SCHOOL_NAME: 'Env Default School', SCHOOL_ADDRESS: 'P.O. Box 1, Zanzibar', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000',
  STORAGE_DIR: storageDir, BACKUP_DIR: backupDir, MYSQLDUMP_PATH: MYSQLDUMP,
});
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });

let passed = 0;
let failed = 0;
function check(name, condition, extra) {
  if (condition) passed += 1;
  else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); }
}

const migrateOut = run('src/scripts/migrate.js');
check('migration 004 applied', migrateOut.includes('004_phase5_system'), migrateOut);
const adminTemp = run('src/scripts/createAdmin.js', ['--name', 'Head Master', '--email', 'head@school.ac.tz']).match(/Temporary password: (\S+)/)[1];

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
  return {
    get: (u) => call('GET', u), post: (u, b) => call('POST', u, b ?? {}), put: (u, b) => call('PUT', u, b), del: (u) => call('DELETE', u),
    raw: (u) => call('GET', u, null, { raw: true }), rawPost: (u, b) => call('POST', u, b ?? {}, { raw: true }),
  };
}
async function signIn(identifier, temp, finalPassword) {
  const s = session();
  await s.post('/auth/login', { identifier, password: temp });
  await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword });
  return s;
}

const admin = await signIn('head@school.ac.tz', adminTemp, 'Headmaster#2026');
let r;

// ---- minimal school setup
const yearId = (await admin.post('/academics/years', { yearLabel: '2026', startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
const termId = (await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
const classId = (await admin.post('/academics/classes', { className: 'Form One', code: 'F1', level: 'o_level' })).data.id;
const streamA = (await admin.post('/academics/streams', { classId, streamName: 'A', code: 'F1A' })).data.id;
const math = (await admin.post('/academics/subjects', { name: 'Mathematics', code: 'MATH', level: 'o_level' })).data.id;
r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@school.ac.tz', role: 'teacher' });
const teacherId = r.data.user.id;
const teacher = await signIn('asha@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');
r = await admin.post('/users', { fullName: 'Fatma Bursar', email: 'bursar@school.ac.tz', role: 'accountant' });
const bursarId = r.data.user.id;
const accountant = await signIn('bursar@school.ac.tz', r.data.temporaryPassword, 'Bursar#2026zz');
r = await admin.post('/users', { fullName: 'Mzee Bakari', phone: '0777 444 555', role: 'parent' });
const parentId = r.data.user.id;
const parent = await signIn('0777444555', r.data.temporaryPassword, 'Parent#2026x');
await admin.post('/academics/assignments', { teacherId, subjectId: math, classId });
const s1 = (await admin.post('/students', { firstName: 'Amina', lastName: 'Said', gender: 'female', dob: '2012-03-14', classId, streamId: streamA, parentName: 'Mzee Bakari', parentPhone: '0777444555', parentUserId: parentId, admissionDate: '2026-01-06' })).data.id;
const s2 = (await admin.post('/students', { firstName: 'Juma', lastName: 'Ali', gender: 'male', dob: '2012-04-01', classId, streamId: streamA, parentName: 'Parent Juma', parentPhone: '0655123456', admissionDate: '2026-01-06' })).data.id;
const tuition = (await accountant.post('/finance/fee-types', { name: 'Tuition Fee', code: 'TUITION' })).data.id;
await accountant.post('/finance/fee-structures', { feeTypeId: tuition, termId, amount: 500000, classIds: [classId] });
r = await accountant.post('/finance/payments', { studentId: s1, amountPaid: 200000, paymentMode: 'bank_transfer', referenceNo: 'CRDB-1', sendSms: false });
const paymentId = r.data.payment.id;
await accountant.post('/finance/expenses', { category: 'utilities', description: 'Electricity', amount: 50000, paymentMode: 'cash' });
const examId = (await admin.post('/exams', { name: 'Midterm', examType: 'midterm', termId })).data.id;
await admin.put(`/exams/${examId}`, { status: 'open' });
await teacher.post('/exams/marks/bulk', { examId, subjectId: math, classId, entries: [{ studentId: s1, score: 81 }] });

// ---- settings
r = await admin.get('/system/settings');
check('Trifonia identity from migration 008; address from .env', r.data.profile.name === 'Trifonia Academy' && r.data.profile.registrationNo === 'S1819' && r.data.profile.motto === 'Knowledge is Power' && r.data.profile.address === 'P.O. Box 1, Zanzibar', r.data);
r = await accountant.get('/system/settings');
check('accountant blocked from settings', r.status === 403, r);
r = await admin.put('/system/settings', { name: 'Al-Noor Academy Zanzibar', registrationNo: 'ZEC/PS/0142', motto: 'Knowledge is Light', headmasterName: 'Dr. Salma Juma', bursarName: 'Fatma Bursar', website: 'not-a-url' });
check('settings validation', r.status === 400 && r.error.details.website, r);
r = await admin.put('/system/settings', { name: 'Al-Noor Academy Zanzibar', registrationNo: 'ZEC/PS/0142', motto: 'Knowledge is Light', headmasterName: 'Dr. Salma Juma', bursarName: 'Fatma Bursar' });
check('settings saved', r.status === 200 && r.data.profile.name === 'Al-Noor Academy Zanzibar' && r.data.profile.address === 'P.O. Box 1, Zanzibar', r.data);
r = await session().get('/school');
check('public /school uses saved settings', r.data.name === 'Al-Noor Academy Zanzibar' && r.data.motto === 'Knowledge is Light' && r.data.hasLogo === false, r.data);
r = await admin.put('/system/settings', { motto: '' });
r = await session().get('/school');
check('clearing reverts to default', r.data.motto === null, r.data);
await admin.put('/system/settings', { motto: 'Knowledge is Light' });

// ---- branding
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
r = await admin.put('/system/branding/logo', { dataUrl: `data:image/png;base64,${PNG}` });
check('upload logo', r.status === 200 && r.data.path === 'branding/logo.png', r);
r = await admin.put('/system/branding/stamp', { dataUrl: `data:image/png;base64,${Buffer.from('not really a png').toString('base64')}` });
check('reject fake image', r.status === 400, r);
r = await admin.put('/system/branding/unknown', { dataUrl: `data:image/png;base64,${PNG}` });
check('unknown asset kind 404', r.status === 404, r);
for (const kind of ['stamp', 'headmaster_signature', 'bursar_signature']) {
  r = await admin.put(`/system/branding/${kind}`, { dataUrl: `data:image/png;base64,${PNG}` });
  check(`upload ${kind}`, r.status === 200, r);
}
r = await accountant.put('/system/branding/logo', { dataUrl: `data:image/png;base64,${PNG}` });
check('accountant cannot upload', r.status === 403, r);
r = await session().raw('/school/logo');
check('public logo served', r.status === 200 && r.headers.get('content-type') === 'image/png' && r.buffer.subarray(1, 4).toString() === 'PNG', r.status);
r = await accountant.raw('/system/branding/stamp');
check('stamp hidden from non-admin', r.status === 403, r.status);
r = await admin.raw('/system/branding/stamp');
check('admin can view stamp', r.status === 200, r.status);
r = await session().get('/school');
check('/school reports logo', r.data.hasLogo === true && r.data.logoVersion > 0, r.data);
check('files stored on disk', readdirSync(path.join(storageDir, 'branding')).length === 4, readdirSync(path.join(storageDir, 'branding')));

// ---- PDFs with branding
r = await accountant.raw(`/finance/payments/${paymentId}/receipt-pdf`);
check('receipt with signature & stamp', r.status === 200 && r.buffer.subarray(0, 4).toString() === '%PDF', r.status);
writeFileSync(path.join(scratch, 'p5-receipt.pdf'), r.buffer);
await admin.put(`/exams/${examId}`, { status: 'closed' });
r = await admin.raw(`/reports/students/${s1}/report-card.pdf?examId=${examId}`);
check('report card with branding', r.status === 200 && r.buffer.subarray(0, 4).toString() === '%PDF', r.status);
writeFileSync(path.join(scratch, 'p5-report-card.pdf'), r.buffer);
r = await admin.get(`/reports/students/${s1}/report-card?examId=${examId}`);
check('report JSON uses settings, no image buffers', r.data.school.name === 'Al-Noor Academy Zanzibar' && r.data.branding === undefined, r.data.school);
await admin.put(`/exams/${examId}`, { status: 'open' });

r = await admin.del('/system/branding/bursar_signature');
check('delete asset', r.status === 200 && readdirSync(path.join(storageDir, 'branding')).length === 3, r);

// ---- audit trail
r = await admin.get('/audit-logs?pageSize=200');
check('audit list', r.status === 200 && r.data.items.length > 20 && r.data.items[0].ipAddress, r.data.pagination);
r = await admin.get('/audit-logs?action=payment.');
check('audit group filter', r.data.items.length === 1 && r.data.items[0].action === 'payment.create', r.data.items.map((i) => i.action));
r = await admin.get(`/audit-logs?userId=${bursarId}&action=expense.create`);
check('audit user + exact action', r.data.items.length === 1 && r.data.items[0].userName === 'Fatma Bursar', r.data.items);
r = await admin.get('/audit-logs?search=CRDB-1');
check('audit details search', r.data.items.some((i) => i.action === 'payment.create'), r.data.items.map((i) => i.action));
r = await admin.get('/audit-logs?action=system.settings_update');
check('settings changes audited with before/after', r.data.items.length >= 3 && r.data.items[0].details.before && r.data.items[0].details.changes, r.data.items[0]);
r = await admin.get('/audit-logs/facets');
check('audit facets', r.data.groups.some((g) => g.group === 'system') && r.data.targetTables.includes('fee_payments'), r.data);
const firstId = (await admin.get('/audit-logs?pageSize=1')).data.items[0].id;
r = await admin.get(`/audit-logs/${firstId}`);
check('audit detail', r.status === 200 && r.data.id === firstId, r);
r = await admin.get('/audit-logs?dateFrom=bad');
check('audit invalid date 400', r.status === 400, r);
r = await accountant.get('/audit-logs');
check('audit admin only', r.status === 403, r);

// ---- backups
r = await admin.rawPost('/system/backup');
check('backup download', r.status === 200 && r.headers.get('content-type') === 'application/gzip' && /\.sql\.gz"/.test(r.headers.get('content-disposition')), { status: r.status, body: r.buffer.toString().slice(0, 300) });
if (r.status === 200) {
  const sql = zlib.gunzipSync(r.buffer).toString('utf8');
  check('backup contains schema and data', sql.includes('CREATE TABLE `students`') && sql.includes('Amina') && sql.includes('Dump completed'), sql.slice(0, 200));
}
r = await admin.get('/audit-logs?action=system.backup_download');
check('backup audited', r.data.items.length === 1 && r.data.items[0].details.uncompressedBytes > 1000, r.data.items);
r = await accountant.rawPost('/system/backup');
check('accountant cannot back up', r.status === 403, r.status);

// Run the cron script itself (Git Bash) against the same database.
const envFile = path.join(scratch, 'p5-backup.env');
writeFileSync(envFile, [
  'DB_HOST=127.0.0.1', 'DB_PORT=3307', 'DB_USER=root', 'DB_PASSWORD=', `DB_NAME=${DB_NAME}`,
  `BACKUP_DIR=${backupDir.replace(/\\/g, '/')}`, 'MYSQLDUMP_PATH="/c/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe"', '',
].join('\n'));
let scriptOutput = '';
try {
  scriptOutput = execFileSync('C:\\Program Files\\Git\\bin\\bash.exe', [path.join(serverDir, 'bin', 'backup-db.sh').replace(/\\/g, '/')], {
    env: { ...process.env, ENV_FILE: envFile.replace(/\\/g, '/'), RETENTION_DAYS: '14' }, encoding: 'utf8',
  });
} catch (error) {
  scriptOutput = `${error.stdout}\n${error.stderr}`;
}
check('backup-db.sh completed', /Backup complete/.test(scriptOutput), scriptOutput);
r = await admin.get('/system/backups');
check('stored backups listed', r.data.items.length === 1 && r.data.items[0].fileName.startsWith(DB_NAME), r.data);
if (r.data.items[0]) {
  const file = r.data.items[0].fileName;
  const download = await admin.raw(`/system/backups/${file}`);
  check('stored backup download', download.status === 200 && zlib.gunzipSync(download.buffer).toString().includes('CREATE TABLE `fee_payments`'), download.status);
}
r = await admin.raw('/system/backups/..%2F..%2Fpasswd.sql.gz');
check('path traversal blocked', r.status === 400 || r.status === 404, r.status);
r = await admin.get('/system/info');
check('system info', r.data.database.tables >= 20 && r.data.lastBackup && r.data.smsConfigured === false, r.data);

// ---- public site: announcements, vision/mission
check('migration 005 applied', migrateOut.includes('005_public_site'), migrateOut);
r = await admin.put('/system/settings', { vision: 'Kuwa shule bora Zanzibar.', mission: 'Kutoa elimu bora.' });
r = await session().get('/school');
check('public school profile has vision/mission/headmaster', r.data.vision === 'Kuwa shule bora Zanzibar.' && r.data.mission === 'Kutoa elimu bora.'
  && r.data.headmasterName === 'Dr. Salma Juma', r.data);
const todayIso = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
r = await admin.post('/system/announcements', { title: 'Usajili wa wanafunzi wapya', body: 'Fomu zinapatikana ofisini.', category: 'admissions' });
check('create announcement', r.status === 201 && r.data.isPublished === true && r.data.publishedAt === todayIso, r);
const liveId = r.data.id;
await admin.post('/system/announcements', { title: 'Hidden draft', body: 'Not yet', isPublished: false });
await admin.post('/system/announcements', { title: 'Future notice', body: 'Later', publishedAt: '2099-01-01' });
await admin.post('/system/announcements', { title: 'Old notice', body: 'Expired', publishedAt: '2020-01-01', expiresAt: '2020-02-01' });
r = await admin.post('/system/announcements', { title: 'Bad dates', body: 'x x x', publishedAt: '2026-05-01', expiresAt: '2026-04-01' });
check('announcement date validation', r.status === 400, r);
r = await session().get('/announcements');
check('public feed shows only live notices', r.status === 200 && r.data.length === 1 && r.data[0].id === liveId && r.data[0].category === 'admissions', r.data);
r = await admin.get('/system/announcements');
check('admin sees all announcements', r.data.length === 4, r.data.length);
r = await admin.put(`/system/announcements/${liveId}`, { isPublished: false });
r = await session().get('/announcements');
check('unpublishing hides notice', r.data.length === 0, r.data);
r = await admin.del(`/system/announcements/${liveId}`);
check('delete announcement', r.status === 200, r);
r = await accountant.post('/system/announcements', { title: 'Not allowed', body: 'Bursar cannot post' });
check('announcements admin-only', r.status === 403, r);
r = await admin.get('/audit-logs?action=announcement.');
check('announcements audited', r.data.items.length >= 6, r.data.items.length);

// ---- role dashboards
r = await admin.get('/dashboard/summary');
check('admin class finance', r.data.classFinance.length === 1 && r.data.classFinance[0].expected === 1000000 && r.data.classFinance[0].collected === 200000
  && r.data.classFinance[0].collectionRate === 20, r.data.classFinance);
r = await accountant.get('/dashboard/summary');
check('bursar dashboard', r.data.monthly.length === 6 && r.data.unpaid.students === 2 && r.data.unpaid.amount === 800000
  && r.data.thisMonth.expenses >= 0 && r.data.recentPayments.length === 1 && r.data.fees.todayAmount === 200000, r.data);
r = await teacher.get('/dashboard/summary');
check('teacher pending marks', r.data.pendingMarks.length === 1 && r.data.pendingMarks[0].pending === 1 && r.data.metrics.pendingMarks === 1, r.data.pendingMarks);
check('teacher class grid', r.data.assignedClasses.length === 1 && r.data.assignedClasses[0].students === 2 && r.data.assignedClasses[0].subjects[0].code === 'MATH', r.data.assignedClasses);
await admin.put(`/exams/${examId}`, { status: 'closed' });
await admin.put(`/exams/${examId}`, { status: 'published' });
r = await parent.get('/dashboard/summary');
const child = r.data.children?.[0];
check('parent portal', child && child.fees.balance === 300000 && child.reports.length === 1 && child.payments.length === 1 && r.data.metrics.totalBalance === 300000, r.data);
r = await parent.raw(`/reports/students/${s1}/report-card.pdf?examId=${examId}`);
check('parent downloads report card', r.status === 200, r.status);
r = await parent.raw(`/reports/students/${s2}/report-card.pdf?examId=${examId}`);
check('parent cannot download other child', r.status === 404 || r.status === 403, r.status);

console.log(`\n${passed} passed, ${failed} failed`);
server.close();
await closePool();
process.exit(failed ? 1 : 0);
