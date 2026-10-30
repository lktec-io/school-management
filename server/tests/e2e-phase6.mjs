// Phase 6 end-to-end: student photos, display order, sequential reg numbers, gender filter, chart data.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const serverDir = process.argv[2];
const scratch = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const storageDir = path.join(scratch, 'p6-storage');
rmSync(storageDir, { recursive: true, force: true });
mkdirSync(storageDir, { recursive: true });

Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_p6_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173', COOKIE_SECURE: 'false',
  SCHOOL_NAME: 'Phase Six School', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000', STORAGE_DIR: storageDir,
});
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });

let passed = 0;
let failed = 0;
function check(name, condition, extra) {
  if (condition) passed += 1;
  else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); }
}

const migrateOut = run('src/scripts/migrate.js');
check('migration 006 applied', migrateOut.includes('006_photos_display_order'), migrateOut);
const rerun = run('src/scripts/migrate.js');
check('migrations idempotent', !rerun.includes('006_photos_display_order') || rerun.includes('up to date') || rerun.includes('No pending'), rerun);
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
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { json = { text }; }
    return { status: res.status, ...json };
  };
  return {
    get: (u) => call('GET', u), post: (u, b) => call('POST', u, b ?? {}), put: (u, b) => call('PUT', u, b), del: (u) => call('DELETE', u),
    raw: (u) => call('GET', u, null, { raw: true }),
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

// ---- setup
const yearId = (await admin.post('/academics/years', { yearLabel: '2026', startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
const termId = (await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
const classId = (await admin.post('/academics/classes', { className: 'Form One', code: 'F1', level: 'o_level', sortOrder: 1 })).data.id;
const class2 = (await admin.post('/academics/classes', { className: 'Form Two', code: 'F2', level: 'o_level', sortOrder: 2 })).data.id;

// ---- display order: streams
r = await admin.post('/academics/streams', { classId, streamName: 'Blue', code: 'F1B', displayOrder: 2 });
check('stream created with displayOrder', r.status === 201 && r.data.displayOrder === 2, r);
const blue = r.data.id;
const red = (await admin.post('/academics/streams', { classId, streamName: 'Red', code: 'F1R', displayOrder: 1 })).data.id;
r = await admin.get('/academics/classes');
let f1 = r.data.find((c) => c.id === classId);
check('streams sorted by displayOrder', f1.streams.map((s) => s.streamName).join(',') === 'Red,Blue', f1.streams);
r = await admin.put(`/academics/streams/${blue}`, { displayOrder: 0 });
check('stream displayOrder updated', r.status === 200 && r.data.displayOrder === 0, r);
f1 = (await admin.get('/academics/classes')).data.find((c) => c.id === classId);
check('re-sorted after update', f1.streams.map((s) => s.streamName).join(',') === 'Blue,Red', f1.streams);
r = await admin.post('/academics/streams', { classId, streamName: 'Bad', code: 'F1X', displayOrder: 5000 });
check('displayOrder range validated', r.status === 400 && r.error.details.displayOrder, r);
r = await admin.post('/academics/streams', { classId: class2, streamName: 'A', code: 'F2A' });
check('displayOrder defaults to 0', r.data.displayOrder === 0, r);

// ---- display order: subjects
await admin.post('/academics/subjects', { name: 'Mathematics', code: 'MATH', level: 'o_level', displayOrder: 3 });
await admin.post('/academics/subjects', { name: 'Kiswahili', code: 'KISW', level: 'o_level', displayOrder: 1 });
r = await admin.post('/academics/subjects', { name: 'English', code: 'ENGL', level: 'o_level', displayOrder: 2 });
const english = r.data.id;
check('subject displayOrder returned', r.data.displayOrder === 2, r);
r = await admin.get('/academics/subjects?level=o_level');
check('subjects sorted by displayOrder', r.data.map((s) => s.code).join(',') === 'KISW,ENGL,MATH', r.data.map((s) => s.code));
r = await admin.put(`/academics/subjects/${english}`, { displayOrder: 9 });
check('subject order updated', r.data.displayOrder === 9, r);
r = await admin.get('/academics/subjects?level=o_level');
check('subjects re-sorted', r.data.map((s) => s.code).join(',') === 'KISW,MATH,ENGL', r.data.map((s) => s.code));

// ---- display order: fee types
await admin.post('/finance/fee-types', { name: 'Uniform', code: 'UNIFORM', displayOrder: 3 });
r = await admin.post('/finance/fee-types', { name: 'Tuition Fee', code: 'TUITION', displayOrder: 1 });
const tuition = r.data.id;
check('fee type displayOrder', r.data.displayOrder === 1, r);
await admin.post('/finance/fee-types', { name: 'Transport', code: 'TRANSPORT', displayOrder: 2 });
r = await admin.get('/finance/fee-types');
check('fee types sorted by displayOrder', r.data.map((f) => f.code).join(',') === 'TUITION,TRANSPORT,UNIFORM', r.data.map((f) => f.code));

// ---- users
r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@school.ac.tz', role: 'teacher' });
const teacherId = r.data.user.id;
const teacher = await signIn('asha@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');
r = await admin.post('/users', { fullName: 'Omar Teacher', email: 'omar@school.ac.tz', role: 'teacher' });
const teacher2 = await signIn('omar@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026b');
r = await admin.post('/users', { fullName: 'Fatma Bursar', email: 'bursar@school.ac.tz', role: 'accountant' });
const accountant = await signIn('bursar@school.ac.tz', r.data.temporaryPassword, 'Bursar#2026zz');
r = await admin.post('/users', { fullName: 'Mzee Bakari', phone: '0777 444 555', role: 'parent' });
const parentId = r.data.user.id;
const parent = await signIn('0777444555', r.data.temporaryPassword, 'Parent#2026x');
r = await admin.post('/users', { fullName: 'Other Parent', phone: '0777 444 666', role: 'parent' });
const otherParent = await signIn('0777444666', r.data.temporaryPassword, 'Parent#2026y');
const math = (await admin.get('/academics/subjects?level=o_level')).data.find((s) => s.code === 'MATH').id;
await admin.post('/academics/assignments', { teacherId, subjectId: math, classId });

// ---- sequential registration numbers
const ids = [];
const people = [
  ['Amina', 'Said', 'female', parentId], ['Juma', 'Ali', 'male', null], ['Zuhura', 'Omar', 'female', null],
];
for (const [firstName, lastName, gender, parentUserId] of people) {
  r = await admin.post('/students', {
    firstName, lastName, gender, dob: '2012-03-14', classId, streamId: red, parentName: 'Guardian', parentPhone: '0777444555',
    parentUserId, admissionDate: '2026-01-06',
  });
  ids.push(r.data.id);
  check(`register ${firstName}`, r.status === 201 && r.data.photoUrl === null, r);
}
const regNos = await Promise.all(ids.map(async (id) => (await admin.get(`/students/${id}`)).data.student.registrationNumber));
check('reg numbers sequential 001..003', regNos.join(',') === 'S1819/2026/001,S1819/2026/002,S1819/2026/003', regNos);
r = await admin.post('/students', { firstName: 'Ali', lastName: 'Hassan', gender: 'male', dob: '2011-03-14', classId: class2, parentName: 'Guardian Two', parentPhone: '0777444555', admissionDate: '2025-02-01' });
check('new year restarts at 001', r.data.registrationNumber === 'S1819/2025/001', r.data);
const f2Student = r.data.id;
r = await session().get('/school');
check('/school exposes regNumberPrefix', r.data.regNumberPrefix === 'S1819', r.data);

// ---- gender filter
r = await admin.get(`/students?gender=female&classId=${classId}`);
check('gender filter', r.data.items.length === 2 && r.data.items.every((s) => s.gender === 'female'), r.data.items.map((s) => s.gender));
r = await admin.get('/students?gender=other');
check('invalid gender rejected', r.status === 400, r);

// ---- student photos
const [amina, juma] = ids;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]).toString('base64');
r = await admin.put(`/students/${amina}/photo`, { dataUrl: `data:image/png;base64,${PNG}` });
check('upload PNG photo', r.status === 200 && /^\/students\/\d+\/photo\?v=/.test(r.data.photoUrl), r);
const firstUrl = r.data.photoUrl;
const firstFiles = readdirSync(path.join(storageDir, 'students'));
check('photo stored on disk', firstFiles.length === 1 && firstFiles[0].startsWith(`${amina}-`) && firstFiles[0].endsWith('.png'), firstFiles);
r = await admin.put(`/students/${amina}/photo`, { dataUrl: `data:image/jpeg;base64,${JPEG}` });
check('replace with JPEG', r.status === 200 && r.data.photoUrl !== firstUrl, r);
const afterReplace = readdirSync(path.join(storageDir, 'students'));
check('old photo file removed', afterReplace.length === 1 && afterReplace[0].endsWith('.jpg'), afterReplace);
r = await admin.put(`/students/${juma}/photo`, { dataUrl: `data:image/png;base64,${Buffer.from('<?php echo 1; ?>').toString('base64')}` });
check('fake image rejected', r.status === 400, r);
r = await admin.put(`/students/${juma}/photo`, { dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
check('GIF rejected', r.status === 400, r);
r = await admin.put(`/students/${juma}/photo`, { dataUrl: `data:image/png;base64,${Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(1.6 * 1024 * 1024)]).toString('base64')}` });
check('oversized photo rejected', r.status === 400 || r.status === 413, r.status);
r = await admin.put('/students/999999/photo', { dataUrl: `data:image/png;base64,${PNG}` });
check('photo for unknown student 404', r.status === 404, r);
r = await accountant.put(`/students/${juma}/photo`, { dataUrl: `data:image/png;base64,${PNG}` });
check('accountant cannot upload photo', r.status === 403, r);
r = await parent.put(`/students/${amina}/photo`, { dataUrl: `data:image/png;base64,${PNG}` });
check('parent cannot upload photo', r.status === 403, r);

r = await admin.raw(`/students/${amina}/photo`);
check('admin views photo', r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && r.headers.get('cache-control').includes('private'), r.status);
r = await accountant.raw(`/students/${amina}/photo`);
check('accountant views photo', r.status === 200, r.status);
r = await teacher.raw(`/students/${amina}/photo`);
check('assigned teacher views photo', r.status === 200, r.status);
r = await teacher2.raw(`/students/${amina}/photo`);
check('unassigned teacher gets 404', r.status === 404, r.status);
r = await parent.raw(`/students/${amina}/photo`);
check('parent views own child photo', r.status === 200, r.status);
r = await otherParent.raw(`/students/${amina}/photo`);
check('other parent gets 404', r.status === 404, r.status);
r = await session().raw(`/students/${amina}/photo`);
check('anonymous blocked', r.status === 401, r.status);
r = await admin.raw(`/students/${juma}/photo`);
check('no photo → 404', r.status === 404, r.status);

r = await admin.get(`/students?classId=${classId}`);
check('list exposes photoUrl', r.data.items.find((s) => s.id === amina).photoUrl?.startsWith(`/students/${amina}/photo`) && r.data.items.find((s) => s.id === juma).photoUrl === null, r.data.items);
check('list hides storage path', !('photoPath' in r.data.items[0]), Object.keys(r.data.items[0]));
r = await parent.get(`/students/${amina}`);
check('profile exposes photoUrl', Boolean(r.data.student.photoUrl), r.data.student);
r = await parent.get('/dashboard/summary');
check('parent dashboard child photoUrl', Boolean(r.data.children[0].photoUrl) && !('photoPath' in r.data.children[0]), r.data.children[0]);

r = await admin.del(`/students/${amina}/photo`);
check('delete photo', r.status === 200, r);
check('photo file deleted', readdirSync(path.join(storageDir, 'students')).length === 0, readdirSync(path.join(storageDir, 'students')));
r = await admin.get(`/students/${amina}`);
check('photoUrl cleared', r.data.student.photoUrl === null, r.data.student);
r = await admin.del(`/students/${amina}/photo`);
check('delete again is harmless', r.status === 200, r);

r = await admin.get('/audit-logs?action=student.photo_upload');
check('photo upload audited', r.status === 200 && r.data.items.length >= 2, r.data?.items?.length);

// ---- branding still works after image-helper refactor
r = await admin.put('/system/branding/logo', { dataUrl: `data:image/png;base64,${PNG}` });
check('branding upload still works', r.status === 200, r);
r = await admin.put('/system/branding/stamp', { dataUrl: `data:image/png;base64,${Buffer.from('nope').toString('base64')}` });
check('branding still rejects fakes', r.status === 400, r);
check('branding dir intact', existsSync(path.join(storageDir, 'branding', 'logo.png')));

// ---- chart data in dashboards
await accountant.post('/finance/fee-structures', { feeTypeId: tuition, termId, amount: 300000, classIds: [classId, class2] });
await accountant.post('/finance/payments', { studentId: amina, amountPaid: 100000, paymentMode: 'mobile_money', referenceNo: 'MP-1', sendSms: false });
await accountant.post('/finance/payments', { studentId: juma, amountPaid: 50000, paymentMode: 'cash', sendSms: false });
await accountant.post('/finance/payments', { studentId: f2Student, amountPaid: 25000, paymentMode: 'cash', sendSms: false });
await accountant.post('/finance/expenses', { category: 'utilities', description: 'Water', amount: 20000, paymentMode: 'cash' });

r = await admin.get('/dashboard/summary');
const d = r.data;
const f1Row = d.studentsByClass.find((c) => c.classId === classId);
check('studentsByClass gender split', f1Row.male === 1 && f1Row.female === 2 && f1Row.students === 3, f1Row);
check('staffByRole', d.staffByRole.teacher === 2 && d.staffByRole.accountant === 1 && d.staffByRole.admin === 1 && d.staffByRole.parent === 2, d.staffByRole);
check('admin monthly series', Array.isArray(d.monthly) && d.monthly.length === 6 && d.monthly.every((m) => /^\d{4}-\d{2}$/.test(m.month)), d.monthly);
const modes = Object.fromEntries(d.paymentModes.map((m) => [m.mode, m]));
check('paymentModes aggregated', modes.cash.amount === 75000 && modes.cash.payments === 2 && modes.mobile_money.amount === 100000 && typeof modes.cash.amount === 'number', d.paymentModes);
check('paymentModes sorted by amount', d.paymentModes[0].mode === 'mobile_money', d.paymentModes);
check('admin classFinance', d.classFinance.find((c) => c.classId === classId).collected === 150000, d.classFinance);
r = await accountant.get('/dashboard/summary');
check('bursar paymentModes + classFinance', r.data.paymentModes.length === 2 && r.data.classFinance.length === 2, r.data);
check('bursar expenses this month', r.data.thisMonth.expenses >= 20000, r.data.thisMonth);
r = await teacher.get('/dashboard/summary');
check('teacher summary unaffected', r.status === 200 && r.data.metrics.classesTaught === 1, r.data.metrics);

console.log(`\nPhase 6: ${passed} passed, ${failed} failed`);
server.close();
await closePool();
process.exit(failed ? 1 : 0);
