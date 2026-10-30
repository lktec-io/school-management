// Bulk results upload: template, validation and row reporting, teacher limits, audit trail, SMS dispatch through a
// mock Beem gateway. Usage: node e2e-results.mjs <serverDir>
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';

const serverDir = process.argv[2];

// Mock Beem: records every message; `gatewayDown` simulates an outage.
const delivered = [];
let gatewayDown = false;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (gatewayDown) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ code: 500, message: 'Gateway unavailable' }));
    }
    const payload = JSON.parse(body);
    delivered.push(payload);
    return res.end(JSON.stringify({ successful: true, request_id: 900 + delivered.length, code: 100, message: 'Message Submitted Successfully', valid: payload.recipients.length, invalid: 0, duplicates: 0 }));
  });
});
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
const beemUrl = `http://127.0.0.1:${mock.address().port}`;

Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_results_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173', COOKIE_SECURE: 'false',
  SCHOOL_NAME: 'Trifonia Academy', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000', SMS_LANGUAGE: 'sw',
  BEEM_API_KEY: 'a1b2c3d4e5f60718', BEEM_SECRET_KEY: 'MzQ1NjdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODk=', BEEM_SENDER_ID: 'TRIFONIA',
  BEEM_BASE_URL: `${beemUrl}/v1/send`, BEEM_BALANCE_URL: `${beemUrl}/balance`,
});
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });

let passed = 0;
let failed = 0;
const check = (name, ok, extra) => { if (ok) passed += 1; else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 900) : ''); } };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

run('src/scripts/migrate.js');
const adminTemp = run('src/scripts/createAdmin.js', ['--name', 'Head Master', '--email', 'head@school.ac.tz']).match(/Temporary password: (\S+)/)[1];
const { default: app } = await import(`file:///${serverDir}/src/app.js`);
const { closePool, query } = await import(`file:///${serverDir}/src/config/db.js`);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

function session() {
  let cookie = '';
  const headers = () => ({ Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) });
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers() }, body: body ? JSON.stringify(body) : undefined });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, ...(await res.json()) };
  };
  return {
    get: (u) => call('GET', u),
    post: (u, b) => call('POST', u, b ?? {}),
    put: (u, b) => call('PUT', u, b),
    raw: async (u) => {
      const res = await fetch(base + u, { headers: headers() });
      return { status: res.status, headers: res.headers, text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer()) };
    },
    upload: async (rowsOrBlob, fields = {}, name = 'matokeo.csv') => {
      const form = new FormData();
      const blob = rowsOrBlob instanceof Blob ? rowsOrBlob : new Blob([rowsOrBlob.map((row) => row.join(',')).join('\r\n')], { type: 'text/csv' });
      form.append('file', blob, name);
      for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
      const res = await fetch(`${base}/results/import`, { method: 'POST', headers: headers(), body: form });
      return { status: res.status, ...(await res.json()) };
    },
  };
}
async function signIn(identifier, temp, finalPassword) {
  const s = session();
  await s.post('/auth/login', { identifier, password: temp });
  await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword });
  return s;
}
const marksOf = (studentId, examId) => query(
  `SELECT sub.code, m.score, m.is_absent AS isAbsent, m.remarks, m.entered_by AS enteredBy, m.updated_by AS updatedBy
     FROM marks m JOIN subjects sub ON sub.id = m.subject_id WHERE m.student_id = ? AND m.exam_id = ? ORDER BY sub.code`,
  [studentId, examId],
);

const admin = await signIn('head@school.ac.tz', adminTemp, 'Headmaster#2026');
const year = new Date().getFullYear();
const TERM = `Term I ${year}`;

// ---- school: Form One (O-level, MATH/ENGL/BIO), Standard One (primary, Mathematics), one teacher
const yearId = (await admin.post('/academics/years', { yearLabel: String(year), startDate: `${year}-01-05`, endDate: `${year}-12-11` })).data.id;
const termId = (await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: `${year}-01-05`, endDate: `${year}-12-11` })).data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
const formOne = (await admin.post('/academics/classes', { className: 'Form One', code: 'F1', level: 'o_level' })).data.id;
const formTwo = (await admin.post('/academics/classes', { className: 'Form Two', code: 'F2', level: 'o_level' })).data.id;
const stdOne = (await admin.post('/academics/classes', { className: 'Standard One', code: 'S1', level: 'primary' })).data.id;
const math = (await admin.post('/academics/subjects', { name: 'Mathematics', code: 'MATH', level: 'o_level' })).data.id;
const engl = (await admin.post('/academics/subjects', { name: 'English', code: 'ENGL', level: 'o_level' })).data.id;
await admin.post('/academics/subjects', { name: 'Biology', code: 'BIO', level: 'o_level' });
await admin.post('/academics/subjects', { name: 'Mathematics', code: 'MATP', level: 'primary' });
await admin.post('/academics/subjects', { name: 'Stadi za Kazi', code: 'STK', level: 'primary' });

let r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@school.ac.tz', role: 'teacher' });
const teacherId = r.data.user.id;
const teacher = await signIn('asha@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');
await admin.post('/academics/assignments', { teacherId, subjectId: math, classId: formOne });
r = await admin.post('/users', { fullName: 'Fee Bursar', email: 'bursar@school.ac.tz', role: 'accountant' });
const bursar = await signIn('bursar@school.ac.tz', r.data.temporaryPassword, 'Bursar#2026a');

const addStudent = async (firstName, lastName, classId, parentName, parentPhone) => (await admin.post('/students', { firstName, lastName, gender: 'male', dob: '2010-03-14', classId, parentName, parentPhone })).data;
const juma = await addStudent('Juma', 'Ali', formOne, 'kusekwa kulwa', '0777 111 001');
const asha = await addStudent('Asha', 'Said', formOne, 'Said Omar', '0777 111 002');
const omar = await addStudent('Omar', 'Faki', formOne, 'Faki Hamad', '0777 111 003');
const zuhura = await addStudent('Zuhura', 'Khamis', formOne, 'Khamis Haji', '0777 111 004');
const salma = await addStudent('Salma', 'Hassan', formTwo, 'Hassan Salum', '0777 111 005');
const baraka = await addStudent('Baraka', 'Ame', stdOne, 'Ame Vuai', '0777 111 006');
const neema = await addStudent('Neema', 'Vuai', formTwo, 'Vuai Ame', '0777 111 007');

const exam = async (name, examType, status = 'open') => {
  const created = (await admin.post('/exams', { name, examType, termId })).data;
  if (status !== 'draft') await admin.put(`/exams/${created.id}`, { status: 'open' });
  if (status === 'closed') await admin.put(`/exams/${created.id}`, { status: 'closed' });
  return created.id;
};
const terminal = await exam('Terminal Exam', 'terminal');
const midterm = await exam('Midterm Exam', 'midterm');
await exam('Annual Exam', 'annual', 'closed');
await exam('Quiz One', 'quiz', 'draft');
const monthlyA = await exam('March Test', 'monthly_test');
await exam('April Test', 'monthly_test');

const HEADER = ['RegistrationNumber', 'StudentName', 'Term', 'ExamType', 'Mathematics', 'English', 'Remarks'];
const row = (student, marks, { term = TERM, type = 'Terminal', name = student.fullName, remarks = '' } = {}) => [student.registrationNumber, name, term, type, ...marks, remarks];

// ---- template
r = await admin.raw('/results/import/template');
let lines = r.text.replace(String.fromCharCode(0xfeff), '').trim().split('\r\n');
check('template: CSV with BOM and the right file name', r.status === 200 && /text\/csv/.test(r.headers.get('content-type')) && r.text.charCodeAt(0) === 0xfeff
  && /trifonia_results_template\.csv/.test(r.headers.get('content-disposition')), r.headers.get('content-disposition'));
check('template: columns in the required order', lines[0] === 'RegistrationNumber,StudentName,Term,ExamType,Biology,English,Mathematics,Stadi za Kazi,Remarks', lines[0]);
check('template: blank one has no sample row', lines.length === 1, lines);
r = await admin.raw(`/results/import/template?examId=${terminal}&classId=${formOne}`);
lines = r.text.replace(String.fromCharCode(0xfeff), '').trim().split('\r\n');
check('template: class roster with Term and ExamType filled', lines.length === 5 && lines[1].startsWith(`${asha.registrationNumber},Asha Said,${TERM},Terminal,`), lines);
check('template: only that level\'s subjects', lines[0] === 'RegistrationNumber,StudentName,Term,ExamType,Biology,English,Mathematics,Remarks', lines[0]);
r = await admin.raw(`/results/import/template?examId=${monthlyA}&classId=${formOne}`);
check('template: uses the exam name when a term has two of that type', r.text.includes(`${TERM},March Test,`), r.text.slice(0, 200));
r = await teacher.raw(`/results/import/template?classId=${formOne}`);
check('template: teacher sees only assigned subjects', r.text.split('\r\n')[0].endsWith('RegistrationNumber,StudentName,Term,ExamType,Mathematics,Remarks'), r.text.slice(0, 120));
check('template: teacher blocked from other classes', (await teacher.raw(`/results/import/template?classId=${formTwo}`)).status === 403);
check('template: bursar blocked', (await bursar.raw('/results/import/template')).status === 403);
check('template: sign-in required', (await session().raw('/results/import/template')).status === 401);

// ---- a mixed file: dry run saves nothing
const mixed = [
  HEADER,
  row(juma, ['78', '64'], { remarks: 'Hongera' }), // 2 good
  row(asha, ['ABS', '55.5']), // 3 absent + decimal
  [`S1819/${year}/999`, 'Hakuna Mtu', TERM, 'Terminal', '50', '50', ''], // 4 unknown student
  row(omar, ['abc', '60']), // 5 bad format, must save nothing for Omar
  row(zuhura, ['101', '-3']), // 6 out of range twice
  row(juma, ['1', '2']), // 7 duplicate of row 2
  row(salma, ['70', '70'], { name: 'Mtu Mwingine' }), // 8 name does not match
  row(salma, ['70', '70'], { term: 'Term IX' }), // 9 unknown term
  row(salma, ['70', '70'], { type: 'Bonanza' }), // 10 unknown exam type
  row(salma, ['70', '70'], { type: 'Annual' }), // 11 exam closed
  row(salma, ['70', '70'], { type: 'Monthly Test' }), // 12 two exams of that type
  row(neema, ['', '']), // 13 no marks
  ['', '', '', '', '', '', ''], // blank spreadsheet row
  row(baraka, ['88', '40']), // 15 English not offered at primary
  ['', 'Bila Namba', TERM, 'Terminal', '50', '50', ''], // 16 no number
];
r = await admin.upload(mixed, { dryRun: true });
check('dry run: counts every row', r.status === 200 && r.data.dryRun === true && r.data.total === 14 && r.data.valid === 2 && r.data.failedCount === 11 && r.data.skippedCount === 1, r.data ?? r);
check('dry run: saves nothing', (await query('SELECT COUNT(*) AS c FROM marks'))[0].c === 0);

r = await admin.upload(mixed);
const failedAt = (line) => r.data.failed.find((entry) => entry.line === line)?.message ?? '';
check('upload: totals', r.status === 201 && r.data.total === 14 && r.data.saved === 2 && r.data.failedCount === 11 && r.data.skippedCount === 1, r.data ?? r);
check('upload: summary message', r.message === '2 of 14 student result record(s) saved; 11 row(s) failed', r.message);
check('Row 4: unknown student, exact wording', failedAt(4) === `Row 4: Student registration number S1819/${year}/999 not found`, failedAt(4));
check('Row 5: invalid marks format', failedAt(5) === 'Row 5: Mathematics — Invalid marks format ("abc")', failedAt(5));
check('Row 6: every bad cell named', /Mathematics — 101 is outside the valid range 0-100; English — -3 is outside the valid range 0-100/.test(failedAt(6)), failedAt(6));
check('Row 7: duplicate pointed at the first row', /Same student and exam as row 2/.test(failedAt(7)), failedAt(7));
check('Row 8: wrong name stops marks reaching the wrong child', /Name "Mtu Mwingine" does not match .* \(Salma Hassan\)/.test(failedAt(8)), failedAt(8));
check('Row 9: unknown term', /Term "Term IX" not found/.test(failedAt(9)), failedAt(9));
check('Row 10: unknown exam type lists the options', /"Bonanza" not recognised/.test(failedAt(10)), failedAt(10));
check('Row 11: closed exam', /Annual Exam is closed/.test(failedAt(11)), failedAt(11));
check('Row 12: ambiguous exam names both', /2 Monthly Test exams \(April Test, March Test\)|2 Monthly Test exams \(March Test, April Test\)/.test(failedAt(12)), failedAt(12));
check('Row 13: empty row reported as skipped', r.data.skipped[0]?.message === 'Row 13: No marks entered for Neema Vuai', r.data.skipped);
check('Row 15: subject not offered at that level', failedAt(15) === 'Row 15: English — Not offered in Standard One', failedAt(15));
check('Row 16: missing number', /RegistrationNumber is required/.test(failedAt(16)), failedAt(16));

let saved = await marksOf(juma.id, terminal);
check('saved marks and remarks', saved.length === 2 && Number(saved[1].score) === 78 && Number(saved[0].score) === 64 && saved[0].remarks === 'Hongera', saved);
saved = await marksOf(asha.id, terminal);
check('ABS records an absence, decimals kept', saved.find((m) => m.code === 'MATH').isAbsent === 1 && saved.find((m) => m.code === 'MATH').score === null && Number(saved.find((m) => m.code === 'ENGL').score) === 55.5, saved);
check('bad row saves nothing for that student', (await marksOf(omar.id, terminal)).length === 0);
check('no SMS unless asked for', delivered.length === 0, delivered);
r = await admin.get(`/exams/${terminal}/results?classId=${formOne}`);
check('uploaded marks reach class results', r.data.students.find((s) => s.studentId === juma.id)?.averagePct === 71, r.data?.students);

// ---- re-uploads
r = await admin.upload([HEADER, row(juma, ['', '70'])]);
saved = await marksOf(juma.id, terminal);
check('blank cell keeps the existing mark', Number(saved.find((m) => m.code === 'MATH').score) === 78 && Number(saved.find((m) => m.code === 'ENGL').score) === 70, saved);
check('update counted', r.data.saved === 1 && r.data.marks.updated === 1 && r.data.marks.inserted === 0, r.data?.marks);
check('remarks kept when the cell is blank', saved.find((m) => m.code === 'ENGL').remarks === 'Hongera', saved);
r = await admin.upload([HEADER, row(juma, ['78', '70'])], { dryRun: true });
check('dry run spots a file with no changes', r.data.rows[0].status === 'unchanged' && r.data.toWrite === 0, r.data);
r = await admin.upload([HEADER, row(juma, ['78', '70'])]);
check('identical file changes nothing', r.status === 200 && r.data.saved === 0 && r.data.unchanged === 1 && r.data.marks.unchanged === 2, r.data);
r = await admin.upload([HEADER, row(juma, ['80', '70'])], { dryRun: true });
check('preview warns before overwriting', r.data.overwrites === 1 && r.data.rows[0].status === 'update', r.data);

// ---- header handling
r = await admin.upload([['RegistrationNumber', 'Term', 'ExamType', 'Mathmatics'], row(juma, ['50']).slice(0, 4)]);
check('misspelt subject rejects the whole file', r.status === 400 && /No subject matches these columns: Mathmatics.*Nothing was saved/.test(r.error.message), r.error);
r = await admin.upload([['StudentName', 'Term', 'ExamType', 'Mathematics'], ['Juma', TERM, 'Terminal', '50']]);
check('missing RegistrationNumber column explained', r.status === 400 && /no RegistrationNumber column/.test(r.error.message), r.error);
r = await admin.upload([['RegistrationNumber', 'Mathematics'], [juma.registrationNumber, '50']]);
check('Term/ExamType columns required', r.status === 400 && /Term and ExamType/.test(r.error.message), r.error);
r = await admin.upload([['RegistrationNumber', 'Mathematics'], [omar.registrationNumber, '50']], { examId: midterm });
check('examId field fills in for those columns', r.status === 201 && r.data.saved === 1 && (await marksOf(omar.id, midterm)).length === 1, r.data ?? r);
r = await admin.upload([['Reg No', 'Muhula', 'Aina ya Mtihani', 'MATH', 'Total', 'Position', 'Maoni'], [omar.registrationNumber, `Term 1 ${year}`, 'Mid-Term', '61', '61', '1', 'Vizuri']]);
check('subject codes, Swahili headers, Term 1, Mid-Term; Total/Position ignored', r.status === 201 && r.data.marks.updated === 1, r.data ?? r);
r = await admin.upload([HEADER, [juma.registrationNumber, 'Juma Ali', 'Term I', 'March Test', '45', '', '']]);
check('year optional; exact exam name resolves ambiguity', r.status === 201 && (await marksOf(juma.id, monthlyA)).length === 1, r.data ?? r);
r = await admin.upload([HEADER, ...Array.from({ length: 501 }, () => row(juma, ['1', '2']))]);
check('more than 500 rows rejected', r.status === 400 && /at most 500/.test(r.error.message), r.error);
r = await admin.upload([HEADER]);
check('header only rejected', r.status === 400 && /no result rows/.test(r.error.message), r.error);
r = await admin.upload(new Blob(['x']), {}, 'old.xls');
check('.xls explained', r.status === 400 && /Old \.xls files/.test(r.error.message), r.error);
r = await admin.upload(new Blob(['a'.repeat(2 * 1024 * 1024 + 10)]), {}, 'huge.csv');
check('over 2 MB rejected', r.status === 400 && /larger than 2 MB/.test(r.error.message), r.error);
const noFile = await fetch(`${base}/results/import`, { method: 'POST', headers: { Origin: 'http://localhost:5173' } });
check('sign-in required to upload', noFile.status === 401, noFile.status);

// ---- Excel (.xlsx with shared strings, numeric marks, deflate)
function xlsx(rows) {
  const strings = [];
  const ref = (text) => { if (!strings.includes(text)) strings.push(text); return strings.indexOf(text); };
  const cells = rows.map((cols, y) => `<row r="${y + 1}">${cols.map((value, x) => {
    if (value === '') return '';
    const at = `${String.fromCharCode(65 + x)}${y + 1}`;
    return typeof value === 'number' ? `<c r="${at}"><v>${value}</v></c>` : `<c r="${at}" t="s"><v>${ref(value)}</v></c>`;
  }).join('')}</row>`).join('');
  const parts = {
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>`,
    'xl/sharedStrings.xml': `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((text) => `<si><t>${text}</t></si>`).join('')}</sst>`,
  };
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(parts)) {
    const data = Buffer.from(content);
    const packed = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 8); end.writeUInt16LE(2, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return new Blob([Buffer.concat([...locals, directory, end])]);
}
r = await admin.upload(xlsx([HEADER, [salma.registrationNumber, 'Salma Hassan', TERM, 'Terminal', 67, 72.5, '']]), {}, 'matokeo.xlsx');
saved = await marksOf(salma.id, terminal);
check('.xlsx upload saved', r.status === 201 && r.data.saved === 1 && Number(saved.find((m) => m.code === 'ENGL').score) === 72.5, r.data ?? r);

// ---- teacher limits
r = await teacher.upload([HEADER, row(zuhura, ['66', ''])]);
check('teacher saves own subject', r.status === 201 && r.data.saved === 1, r.data ?? r);
check('marks credited to the teacher', (await marksOf(zuhura.id, terminal))[0].enteredBy === teacherId);
r = await teacher.upload([HEADER, row(zuhura, ['66', '70'])]);
check('teacher blocked from other subjects, row untouched', r.data.saved === 0 && /English — You are not assigned/.test(r.data.failed[0].message) && (await marksOf(zuhura.id, terminal)).length === 1, r.data);
r = await teacher.upload([HEADER, row(salma, ['66', ''])]);
check('teacher blocked from other classes', r.data.saved === 0 && /You are not assigned/.test(r.data.failed[0].message), r.data);
r = await teacher.upload([HEADER, row(zuhura, ['67', ''])], { sendSms: true });
check('only the Headmaster can text results', r.status === 403 && (await marksOf(zuhura.id, terminal))[0].score !== '67.00', r);
r = await bursar.upload([HEADER, row(zuhura, ['67', ''])]);
check('bursar cannot upload', r.status === 403, r.status);

// ---- audit trail
const [audit] = await query("SELECT user_id AS userId, details FROM audit_logs WHERE action = 'results.import' ORDER BY id LIMIT 1");
const details = typeof audit?.details === 'string' ? JSON.parse(audit.details) : audit?.details;
check('audit: who, which file, what happened', audit?.userId !== teacherId && details?.fileName === 'matokeo.csv' && details.saved === 2 && details.failed === 11 && details.marks.inserted === 4 && details.sendSms === false, audit);
const [overwrite] = await query("SELECT details FROM audit_logs WHERE action = 'results.import' AND JSON_LENGTH(details, '$.overwritten') > 0 ORDER BY id LIMIT 1");
const changed = (typeof overwrite?.details === 'string' ? JSON.parse(overwrite.details) : overwrite?.details)?.overwritten?.[0];
check('audit: overwritten marks keep their old value', Number(changed?.before.score) === 64 && Number(changed?.after.score) === 70, changed);

// ---- SMS through Beem
const settle = async (count) => {
  for (let i = 0; i < 60 && delivered.reduce((sum, p) => sum + p.recipients.length, 0) < count; i += 1) await sleep(100);
  await sleep(200);
};
r = await admin.upload([HEADER, row(omar, ['62', '58']), row(asha, ['ABS', 'ABS'])], { sendSms: true });
check('SMS: reported in the response', r.status === 201 && r.data.sms.requested === true && r.data.sms.configured === true && r.data.sms.recipients === 1 && r.data.sms.noResult === 1 && Boolean(r.data.sms.batchId), r.data?.sms);
await settle(1);
check('SMS: Beem received one message', delivered.length === 1 && delivered[0].recipients[0].dest_addr === '255777111003', delivered);
check('SMS: guardian name UPPERCASE, student, exam, average', delivered[0]?.message === `Trifonia Academy: Ndugu FAKI HAMAD, matokeo ya Omar Faki (${omar.registrationNumber}) Terminal Exam Term I ${year}: wastani 60%, gredi C.`, delivered[0]?.message);
check('SMS: logged as results', (await query("SELECT COUNT(*) AS c FROM sms_logs WHERE category = 'results' AND status = 'sent'"))[0].c === 1);
const [smsAudit] = await query("SELECT user_id AS userId FROM audit_logs WHERE action = 'sms.results_import'");
check('SMS: audited', Boolean(smsAudit));

r = await admin.upload([HEADER, row(omar, ['62', '58'])], { sendSms: true });
await sleep(400);
check('SMS: re-uploading the same file texts nobody', r.data.saved === 0 && delivered.length === 1, { saved: r.data?.saved, delivered: delivered.length });
await query('UPDATE students SET parent_phone = ? WHERE id = ?', ['12345', zuhura.id]);
r = await admin.upload([HEADER, row(zuhura, ['68', ''])], { sendSms: true });
check('SMS: invalid phone reported, marks kept', r.data.saved === 1 && r.data.sms.invalidPhones === 1 && r.data.sms.recipients === 0, r.data?.sms);
gatewayDown = true;
r = await admin.upload([HEADER, row(salma, ['69', ''])], { sendSms: true });
await sleep(800);
gatewayDown = false;
check('SMS: gateway outage does not lose marks', r.status === 201 && r.data.saved === 1 && Number((await marksOf(salma.id, terminal)).find((m) => m.code === 'MATH').score) === 69, r.data ?? r);
check('SMS: failure logged for retry', (await query("SELECT COUNT(*) AS c FROM sms_logs WHERE category = 'results' AND status = 'failed'"))[0].c === 1);

// ---- existing rules still hold
r = await admin.post('/sms/preview', { target: { type: 'exam_results', examId: terminal, classId: formOne }, message: 'Mzazi {parent_name}: {average}' });
check('broadcast still requires a published exam', r.status === 409, r);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
server.close();
mock.close();
await closePool();
process.exit(failed ? 1 : 0);
