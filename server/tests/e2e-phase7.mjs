// Phase 7: profile photos for every role, auto payment references, receipt preview,
// bilingual payment SMS, Beem response-code messages. Usage: node e2e-phase7.mjs <serverDir>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const serverDir = process.argv[2];
const scratch = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const storageDir = path.join(scratch, 'p7-storage');
rmSync(storageDir, { recursive: true, force: true });
mkdirSync(storageDir, { recursive: true });

// Mock Beem: accepts everything except sender "BADSENDER" (code 111).
const beem = { requests: [] };
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/balance') return res.end(JSON.stringify({ data: { credit_balance: 900 } }));
    const payload = JSON.parse(body);
    beem.requests.push(payload);
    if (payload.source_addr === 'BADSENDER') { res.statusCode = 400; return res.end(JSON.stringify({ code: 111, message: 'Invalid Sender ID' })); }
    return res.end(JSON.stringify({ successful: true, request_id: 1, code: 100, message: 'Message Submitted Successfully' }));
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const beemBase = `http://127.0.0.1:${mock.address().port}`;

Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_p7_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173', COOKIE_SECURE: 'false',
  SCHOOL_NAME: 'Phase Seven School', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000', STORAGE_DIR: storageDir,
  BEEM_API_KEY: 'k', BEEM_SECRET_KEY: 'secret-value', BEEM_SENDER_ID: 'ALNOOR',
  BEEM_BASE_URL: `${beemBase}/v1/send`, BEEM_BALANCE_URL: `${beemBase}/balance`,
});
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });

let passed = 0;
let failed = 0;
const check = (name, ok, extra) => { if (ok) passed += 1; else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };

const migrateOut = run('src/scripts/migrate.js');
check('migration 007 applied', migrateOut.includes('007_user_photos'), migrateOut);
const adminTemp = run('src/scripts/createAdmin.js', ['--name', 'Head Master', '--email', 'head@school.ac.tz']).match(/Temporary password: (\S+)/)[1];

const { default: app } = await import(`file:///${serverDir}/src/app.js`);
const { closePool, query } = await import(`file:///${serverDir}/src/config/db.js`);
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
  return { cookie: () => cookie, get: (u) => call('GET', u), post: (u, b) => call('POST', u, b ?? {}), put: (u, b) => call('PUT', u, b), del: (u) => call('DELETE', u), raw: (u) => call('GET', u, null, { raw: true }) };
}
async function signIn(identifier, temp, finalPassword) {
  const s = session();
  await s.post('/auth/login', { identifier, password: temp });
  await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword });
  return s;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const admin = await signIn('head@school.ac.tz', adminTemp, 'Headmaster#2026');
let r;
const yearId = (await admin.post('/academics/years', { yearLabel: '2026', startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
const termId = (await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
const classId = (await admin.post('/academics/classes', { className: 'Form Two', code: 'F2', level: 'o_level' })).data.id;
r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@school.ac.tz', role: 'teacher' });
const teacherId = r.data.user.id;
const teacher = await signIn('asha@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');
r = await admin.post('/users', { fullName: 'Fatma Bursar', email: 'bursar@school.ac.tz', role: 'accountant' });
const accountant = await signIn('bursar@school.ac.tz', r.data.temporaryPassword, 'Bursar#2026zz');
r = await admin.post('/users', { fullName: 'Mzee Bakari', phone: '0777 444 555', role: 'parent' });
const parentId = r.data.user.id;
const parent = await signIn('0777444555', r.data.temporaryPassword, 'Parent#2026x');
const studentId = (await admin.post('/students', { firstName: 'Amina', lastName: 'Said', gender: 'female', dob: '2011-03-14', classId, parentName: 'Mzee Bakari', parentPhone: '0777444555', parentUserId: parentId, admissionDate: '2026-01-06' })).data.id;
const tuition = (await accountant.post('/finance/fee-types', { name: 'Tuition Fee', code: 'TUITION' })).data.id;
await accountant.post('/finance/fee-structures', { feeTypeId: tuition, termId, amount: 400000, classIds: [classId] });

// ---- profile photos for every role
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
r = await admin.get('/auth/me');
check('me has photoUrl null', r.data.user.photoUrl === null, r.data);
for (const [label, s] of [['admin', admin], ['teacher', teacher], ['bursar', accountant], ['parent', parent]]) {
  r = await s.put('/auth/me/photo', { dataUrl: `data:image/png;base64,${PNG}` });
  check(`${label} uploads own photo`, r.status === 200 && /^\/auth\/users\/\d+\/photo\?v=/.test(r.data.user.photoUrl), r);
  r = await s.raw(r.data.user.photoUrl);
  check(`${label} views own photo`, r.status === 200 && r.headers.get('content-type') === 'image/png', r.status);
}
check('photos stored under STORAGE_DIR/profiles', readdirSync(path.join(storageDir, 'profiles')).length === 4, readdirSync(path.join(storageDir, 'profiles')));
r = await teacher.get('/auth/me');
const teacherPhoto = r.data.user.photoUrl;
check('/auth/me returns photoUrl after upload', Boolean(teacherPhoto), r.data);
r = await admin.raw(teacherPhoto);
check('admin can view a teacher photo', r.status === 200, r.status);
r = await parent.raw(teacherPhoto);
check('parent cannot view another user photo', r.status === 404, r.status);
r = await session().raw(teacherPhoto);
check('anonymous blocked', r.status === 401, r.status);
r = await teacher.put('/auth/me/photo', { dataUrl: `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}` });
check('fake image rejected', r.status === 400, r);
r = await teacher.put('/auth/me/photo', { dataUrl: `data:image/png;base64,${PNG}` });
check('replacing removes old file', readdirSync(path.join(storageDir, 'profiles')).filter((f) => f.startsWith(`${teacherId}-`)).length === 1, readdirSync(path.join(storageDir, 'profiles')));
r = await teacher.del('/auth/me/photo');
check('delete own photo', r.status === 200 && r.data.user.photoUrl === null, r);
check('file removed', !readdirSync(path.join(storageDir, 'profiles')).some((f) => f.startsWith(`${teacherId}-`)));
r = await admin.get('/audit-logs?action=user.photo_upload');
check('photo uploads audited', r.data.items.length >= 5, r.data.items.length);

// ---- receipt preview + automatic references
r = await accountant.get('/finance/payments/next-receipt');
check('next receipt preview', r.status === 200 && r.data.receiptNo === 'RCT-2026-0001', r);
r = await accountant.post('/finance/payments', { studentId, amountPaid: 100000, paymentMode: 'bank_transfer', sendSms: false });
check('non-cash payment without manual reference accepted', r.status === 201, r);
check('reference auto-set to receipt number', r.data.payment.receiptNo === 'RCT-2026-0001' && r.data.payment.referenceNo === 'RCT-2026-0001', r.data?.payment);
r = await accountant.post('/finance/payments', { studentId, amountPaid: 50000, paymentMode: 'cash', sendSms: false });
check('sequential receipt', r.data.payment.receiptNo === 'RCT-2026-0002' && r.data.payment.referenceNo === 'RCT-2026-0002', r.data?.payment);
r = await accountant.post('/finance/payments', { studentId, amountPaid: 25000, paymentMode: 'mobile_money', referenceNo: 'mp123abc', sendSms: false });
check('manual reference kept (uppercased)', r.data.payment.referenceNo === 'MP123ABC' && r.data.payment.receiptNo === 'RCT-2026-0003', r.data?.payment);
r = await accountant.get('/finance/payments/next-receipt');
check('preview follows sequence', r.data.receiptNo === 'RCT-2026-0004', r.data);
r = await accountant.get('/finance/payments/next-receipt?paymentDate=2025-06-01');
check('preview per year', r.data.receiptNo === 'RCT-2025-0001', r.data);
r = await teacher.get('/finance/payments/next-receipt');
check('teacher cannot preview receipts', r.status === 403, r.status);

// ---- bilingual automatic payment SMS (SMS_LANGUAGE defaults to Kiswahili)
r = await accountant.post('/finance/payments', { studentId, amountPaid: 10000, paymentMode: 'cash', sendSms: true });
check('confirmation queued', r.data.sms.queued === true, r.data.sms);
await sleep(600);
const sw = beem.requests.at(-1);
check('confirmation in Kiswahili', sw && /Tumepokea TZS 10,000 kwa ajili ya Amina Said/.test(sw.message) && /risiti RCT-2026-0004/.test(sw.message) && /Salio la Term I 2026/.test(sw.message), sw?.message);
check('Beem payload types per spec', sw.encoding === 0 && sw.schedule_time === '' && Number.isInteger(sw.recipients[0].recipient_id) && sw.recipients[0].dest_addr === '255777444555', sw);

// ---- Beem response codes surface as readable messages (code 111 via a bad sender in a child process)
const out = await new Promise((resolve) => {
  const child = spawn(process.execPath, ['src/scripts/checkSms.js', '0777444555'], { cwd: serverDir, env: { ...process.env, BEEM_SENDER_ID: 'BADSENDER' } });
  let text = '';
  child.stdout.on('data', (d) => { text += d; });
  child.stderr.on('data', (d) => { text += d; });
  child.on('close', () => resolve(text));
});
check('code 111 explained', /Sender ID is not registered or not active — check BEEM_SENDER_ID \(Beem code 111\)/.test(out), out);
const [logRow] = await query("SELECT error_message AS e FROM sms_logs WHERE status = 'failed' ORDER BY id DESC LIMIT 1");
check('failure stored with explanation', /Beem code 111/.test(logRow?.e ?? ''), logRow);

// ---- multipart/form-data profile photo upload (field "photo")
async function multipart(s, field, bytes, type = 'image/png', name = 'me.png') {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), name);
  const res = await fetch(base + '/auth/me/photo', { method: 'PUT', body: form, headers: { Origin: 'http://localhost:5173', Cookie: s.cookie() } });
  return { status: res.status, ...(await res.json()) };
}
const pngBytes = Buffer.from(PNG, 'base64');
r = await multipart(parent, 'photo', pngBytes);
check('multipart upload accepted', r.status === 200 && /^\/auth\/users\/\d+\/photo\?v=/.test(r.data.user.photoUrl), r);
check('multipart file stored in profiles/', readdirSync(path.join(storageDir, 'profiles')).some((f) => f.startsWith(`${parentId}-`) && f.endsWith('.png')));
r = await multipart(parent, 'avatar', pngBytes);
check('wrong multipart field rejected', r.status === 400, r);
r = await multipart(parent, 'photo', Buffer.concat([pngBytes, Buffer.alloc(1.6 * 1024 * 1024)]));
check('oversized multipart rejected', r.status === 400 && /1\.5 MB/.test(r.error.message), r);
r = await multipart(parent, 'photo', Buffer.from('GIF89a-not-allowed'), 'image/gif', 'x.gif');
check('non PNG/JPEG multipart rejected', r.status === 400, r);

// ---- Trifonia identity (migration 008) and S1819 registration numbers
r = await session().get('/school');
check('public identity is Trifonia Academy', r.data.name === 'Trifonia Academy' && r.data.registrationNo === 'S1819' && r.data.motto === 'Knowledge is Power' && r.data.phone.includes('+255 776 119 799') && r.data.regNumberPrefix === 'S1819', r.data);
r = await admin.get(`/students/${studentId}`);
check('registration number uses S1819 prefix', r.data.student.registrationNumber === 'S1819/2026/001', r.data.student.registrationNumber);
r = await admin.put('/system/settings', { name: 'Trifonia Academy', instagramUrl: 'https://www.instagram.com/trifonia_academy' });
check('instagram URL saved', r.status === 200 && r.data.profile.instagramUrl === 'https://www.instagram.com/trifonia_academy', r);
r = await session().get('/school');
check('instagram URL public', r.data.instagramUrl === 'https://www.instagram.com/trifonia_academy', r.data);
r = await admin.put('/system/settings', { name: 'Trifonia Academy', instagramUrl: 'javascript:alert(1)' });
check('non-instagram URL rejected', r.status === 400, r);

// ---- phone normalisation for Beem
const { normalizeTzPhone } = await import(`file:///${serverDir}/src/utils/phone.js`);
check('phone formats → 255XXXXXXXXX', ['0776119799', '+255 776 119 799', '00255776119799', '2550776119799', '776-119-799', '0656 499 288']
  .map(normalizeTzPhone).join(',') === '255776119799,255776119799,255776119799,255776119799,255776119799,255656499288',
['0776119799', '+255 776 119 799', '00255776119799', '2550776119799', '776-119-799', '0656 499 288'].map(normalizeTzPhone));
check('invalid phone rejected', normalizeTzPhone('12345') === null && normalizeTzPhone('+254712345678') === null);

// ---- credential fingerprint printed for comparison with the server log
const fp = await new Promise((resolve) => {
  const child = spawn(process.execPath, ['src/scripts/checkSms.js'], { cwd: serverDir, env: { ...process.env } });
  let text = '';
  child.stdout.on('data', (d) => { text += d; });
  child.stderr.on('data', (d) => { text += d; });
  child.on('close', () => resolve(text));
});
check('sms:check prints key fingerprint', /Fingerprint [0-9a-f]{12}/.test(fp) && !fp.includes('secret-value'), fp);

console.log(`\nPhase 7: ${passed} passed, ${failed} failed`);
server.close();
mock.close();
await closePool();
process.exit(failed ? 1 : 0);
