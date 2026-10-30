// Phase 8: results trend + division breakdown (ME/KE), parent per-child trend, "Remember me"
// session cookies, registration-prefix renumbering. Usage: node e2e-phase8.mjs <serverDir>
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';

const serverDir = process.argv[2];
Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_p8_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173', COOKIE_SECURE: 'false',
  SCHOOL_NAME: 'Trifonia Academy', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000',
});
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });
const runAsync = (script, args = [], env = {}) => new Promise((resolve) => {
  const child = spawn(process.execPath, [script, ...args], { cwd: serverDir, env: { ...process.env, ...env } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => resolve({ code, out }));
});

let passed = 0;
let failed = 0;
const check = (name, ok, extra) => { if (ok) passed += 1; else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 800) : ''); } };

run('src/scripts/migrate.js');
const adminTemp = run('src/scripts/createAdmin.js', ['--name', 'Head Master', '--email', 'head@school.ac.tz']).match(/Temporary password: (\S+)/)[1];
const { default: app } = await import(`file:///${serverDir}/src/app.js`);
const { closePool, query } = await import(`file:///${serverDir}/src/config/db.js`);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

function session() {
  let cookie = '';
  let lastSetCookie = null;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) { cookie = setCookie.split(';')[0]; lastSetCookie = setCookie; }
    return { status: res.status, ...(await res.json()) };
  };
  return {
    lastSetCookie: () => lastSetCookie,
    get: (u) => call('GET', u), post: (u, b) => call('POST', u, b ?? {}), put: (u, b) => call('PUT', u, b), del: (u) => call('DELETE', u),
  };
}
async function signIn(identifier, temp, finalPassword) {
  const s = session();
  await s.post('/auth/login', { identifier, password: temp });
  await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword });
  return s;
}

// ---- "Remember me" → persistent vs browser-session cookie
let s = session();
let r = await s.post('/auth/login', { identifier: 'head@school.ac.tz', password: adminTemp, remember: false });
check('login without remember → session cookie (no Max-Age)', r.status === 200 && !/Max-Age|Expires/i.test(s.lastSetCookie()), s.lastSetCookie());
r = await s.post('/auth/change-password', { currentPassword: adminTemp, newPassword: 'Headmaster#2026' });
check('password change keeps the session-only cookie', r.status === 200 && !/Max-Age|Expires/i.test(s.lastSetCookie()), s.lastSetCookie());
const admin = session();
r = await admin.post('/auth/login', { identifier: 'head@school.ac.tz', password: 'Headmaster#2026', remember: true });
check('login with remember → persistent cookie', r.status === 200 && /Max-Age=\d+/i.test(admin.lastSetCookie()), admin.lastSetCookie());
const legacy = session();
await legacy.post('/auth/login', { identifier: 'head@school.ac.tz', password: 'Headmaster#2026' });
check('older clients (no flag) stay persistent', /Max-Age=\d+/i.test(legacy.lastSetCookie()), legacy.lastSetCookie());

// Old registration number in School Settings, so students get ZNZ/ numbers for the renumbering test.
r = await admin.put('/system/settings', { registrationNo: 'ZNZ' });
check('prefix follows School Settings registration number', r.status === 200 && (await admin.get('/school')).data.regNumberPrefix === 'ZNZ');

// ---- school with an O-level class, 7 subjects, 4 students (3 ME, 1 KE)
const yearId = (await admin.post('/academics/years', { yearLabel: '2026', startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
const termId = (await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: '2026-01-05', endDate: '2026-12-11' })).data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
const classId = (await admin.post('/academics/classes', { className: 'Form Four', code: 'F4', level: 'o_level' })).data.id;
const subjects = [];
for (const [name, code] of [['Mathematics', 'MATH'], ['English', 'ENGL'], ['Kiswahili', 'KISW'], ['Biology', 'BIO'], ['Chemistry', 'CHEM'], ['Physics', 'PHY'], ['Geography', 'GEO']]) {
  subjects.push((await admin.post('/academics/subjects', { name, code, level: 'o_level' })).data.id);
}
r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@school.ac.tz', role: 'teacher' });
const teacherId = r.data.user.id;
const teacher = await signIn('asha@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');
for (const subjectId of subjects) await admin.post('/academics/assignments', { teacherId, subjectId, classId });
r = await admin.post('/users', { fullName: 'Mzee Bakari', phone: '0777 444 555', role: 'parent' });
const parentId = r.data.user.id;
const parent = await signIn('0777444555', r.data.temporaryPassword, 'Parent#2026x');
const students = [];
for (const [firstName, gender, parentUserId] of [['Juma', 'male', parentId], ['Ali', 'male', null], ['Omari', 'male', null], ['Amina', 'female', null]]) {
  students.push((await admin.post('/students', { firstName, lastName: 'Test', gender, dob: '2009-03-14', classId, parentName: 'Guardian Name', parentPhone: '0777444555', parentUserId, admissionDate: '2026-01-06' })).data.id);
}
// Scores per student: Juma all A (Div I), Ali B/C (Div II-ish), Omari D (Div IV), Amina A (Div I)
const SCORES = { 0: 85, 1: 66, 2: 32, 3: 90 };
async function examWithMarks(name, bump) {
  const examId = (await admin.post('/exams', { name, examType: 'terminal', termId })).data.id;
  await admin.put(`/exams/${examId}`, { status: 'open' });
  for (const subjectId of subjects) {
    await teacher.post('/exams/marks/bulk', { examId, subjectId, classId, entries: students.map((studentId, index) => ({ studentId, score: Math.min(100, SCORES[index] + bump) })) });
  }
  return examId;
}
const exam1 = await examWithMarks('Midterm', 0);

r = await admin.get('/dashboard/summary');
const perf = r.data.performance;
const divs = Object.fromEntries((perf?.divisions?.rows ?? []).map((row) => [row.label, row]));
check('division breakdown rows', divs.I?.total === 3 && divs.I.male === 2 && divs.I.female === 1 && divs.IV?.total === 1 && divs.IV.male === 1, perf?.divisions);
check('division totals ME/KE', perf.divisions.totals.male === 3 && perf.divisions.totals.female === 1 && perf.divisions.totals.total === 4, perf.divisions.totals);
check('divisions in NECTA order', perf.divisions.rows.map((row) => row.label).join(',') === ['I', 'II', 'III', 'IV', '0'].filter((d) => divs[d]).join(','), perf.divisions.rows.map((row) => row.label));
check('trend has one point', r.data.trend.length === 1 && r.data.trend[0].examId === exam1 && typeof r.data.trend[0].meanAverage === 'number', r.data.trend);

const exam2 = await examWithMarks('Terminal', 6);
r = await admin.get('/dashboard/summary');
check('trend oldest → newest', r.data.trend.map((p) => p.label).join(',') === 'Midterm,Terminal', r.data.trend);
check('trend shows improvement', r.data.trend[1].meanAverage > r.data.trend[0].meanAverage, r.data.trend);
r = await teacher.get('/dashboard/summary');
check('teacher trend for own classes', r.data.trend.length === 2 && r.data.performance?.divisions?.totals.total === 4, r.data.trend);

// Parent trend only shows published exams.
r = await parent.get('/dashboard/summary');
check('parent trend empty before publishing', Array.isArray(r.data.children[0].trend) && r.data.children[0].trend.length === 0, r.data.children[0].trend);
for (const examId of [exam1, exam2]) {
  await admin.put(`/exams/${examId}`, { status: 'closed' });
  await admin.put(`/exams/${examId}`, { status: 'published' });
}
r = await parent.get('/dashboard/summary');
const childTrend = r.data.children[0].trend;
check('parent per-child trend (published, oldest first)', childTrend.length === 2 && childTrend[0].label === 'Midterm' && childTrend[1].averagePct > childTrend[0].averagePct, childTrend);

// ---- registration-prefix renumbering (ZNZ → S1819)
const before = (await query('SELECT registration_number AS n FROM students ORDER BY id')).map((row) => row.n);
check('students created with old prefix', before.every((n) => n.startsWith('ZNZ/2026/')), before);
await admin.put('/system/settings', { registrationNo: 'S1819' });
let out = await runAsync('src/scripts/renumberRegistrations.js', ['--from', 'ZNZ']);
check('dry run lists changes', out.code === 0 && out.out.includes('ZNZ/2026/001  →  S1819/2026/001') && out.out.includes('Preview only'), out.out);
check('dry run changes nothing', (await query("SELECT COUNT(*) AS c FROM students WHERE registration_number LIKE 'ZNZ/%'"))[0].c === 4);
out = await runAsync('src/scripts/renumberRegistrations.js', ['--from', 'ZNZ', '--to', 'S1819', '--apply']);
const after = (await query('SELECT registration_number AS n FROM students ORDER BY id')).map((row) => row.n);
check('apply converts every number, keeps year/sequence', out.code === 0 && after.join(',') === before.map((n) => n.replace(/^ZNZ\//, 'S1819/')).join(','), { out: out.out, after });
const [audit] = await query("SELECT details FROM audit_logs WHERE action = 'student.registration_prefix_change'");
const details = typeof audit?.details === 'string' ? JSON.parse(audit.details) : audit?.details;
check('renumbering audited', details?.count === 4 && details.from === 'ZNZ' && details.to === 'S1819', audit);
out = await runAsync('src/scripts/renumberRegistrations.js', ['--from', 'ZNZ', '--to', 'S1819', '--apply']);
check('re-run is a no-op', out.code === 0 && out.out.includes('0 student record(s)'), out.out);

console.log(`\nPhase 8: ${passed} passed, ${failed} failed`);
server.close();
await closePool();
process.exit(failed ? 1 : 0);
