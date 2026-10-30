// Phase 9: S1819 prefix from School Settings, Instagram reels setting, next registration number preview,
// guardian relationship, bulk student import (template / preview / commit), UPPERCASE guardian names in SMS.
// Usage: node e2e-phase9.mjs <serverDir>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const serverDir = process.argv[2];
Object.assign(process.env, {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_p9_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173', COOKIE_SECURE: 'false',
  SCHOOL_NAME: 'Trifonia Academy', RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000',
});
delete process.env.REG_NUMBER_PREFIX;
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], { env: { ...process.env }, cwd: serverDir, encoding: 'utf8' });

let passed = 0;
let failed = 0;
const check = (name, ok, extra) => { if (ok) passed += 1; else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 900) : ''); } };

run('src/scripts/migrate.js');
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
    if (raw) return { status: res.status, headers: res.headers, text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer()) };
    return { status: res.status, ...(await res.json()) };
  };
  // multipart/form-data upload (fetch sets the boundary header itself).
  const upload = async (url, form) => {
    const res = await fetch(base + url, { method: 'POST', headers: { Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) }, body: form });
    return { status: res.status, ...(await res.json()) };
  };
  return {
    get: (u, o) => call('GET', u, undefined, o), post: (u, b) => call('POST', u, b ?? {}), put: (u, b) => call('PUT', u, b), upload,
  };
}
async function signIn(identifier, temp, finalPassword) {
  const s = session();
  await s.post('/auth/login', { identifier, password: temp });
  await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword });
  return s;
}

const admin = await signIn('head@school.ac.tz', adminTemp, 'Headmaster#2026');
const year = new Date().getFullYear();

// ---- prefix + reels from School Settings
let r = await session().get('/school');
check('public /school: S1819 prefix', r.data.regNumberPrefix === 'S1819', r.data);
check('public /school: three seeded videos, new reel first', JSON.stringify(r.data.instagramReels) === JSON.stringify(['DdgH5x0gtdl', 'Dd_c3hOgiCW', 'yt:uP2_RXm-cn8']), r.data.instagramReels);
r = await admin.put('/system/settings', { instagramReels: 'https://www.instagram.com/reel/DdgH5x0gtdl/?rpxt=NnplcnE0cGdyNm5w\nhttps://www.instagram.com/reel/Dd_c3hOgiCW/\nhttps://www.instagram.com/p/C9xYz12AbCd/' });
check('reel links saved as codes', r.status === 200 && r.data.profile.instagramReels === 'DdgH5x0gtdl\nDd_c3hOgiCW\nC9xYz12AbCd', r);
r = await session().get('/school');
check('public reels follow settings (3)', r.data.instagramReels.length === 3 && r.data.instagramReels[2] === 'C9xYz12AbCd', r.data.instagramReels);
r = await admin.put('/system/settings', { instagramReels: 'https://evil.example/reel/abc123' });
check('links from other sites rejected', r.status === 400 && /Not an Instagram or YouTube video link/.test(r.error.details.instagramReels), r);
r = await admin.put('/system/settings', { instagramReels: 'https://www.instagram.com/reel/DdgH5x0gtdl/\nhttps://www.youtube.com/watch?v=uP2_RXm-cn8' });
check('YouTube links saved with yt: prefix', r.status === 200 && r.data.profile.instagramReels === 'DdgH5x0gtdl\nyt:uP2_RXm-cn8', r.data?.profile?.instagramReels);
r = await admin.put('/system/settings', { instagramReels: 'AAAAA1\nBBBBB2\nCCCCC3\nDDDDD4' });
check('more than 3 reels rejected', r.status === 400 && /at most 3/.test(r.error.details.instagramReels), r);
r = await admin.put('/system/settings', { registrationNo: 'Reg. No. S1819' });
check('prefix extracted from a written-out registration number', (await session().get('/school')).data.regNumberPrefix === 'S1819');
await admin.put('/system/settings', { registrationNo: 'S1819' });

// ---- school setup: one class with a small stream, a teacher
const yearId = (await admin.post('/academics/years', { yearLabel: String(year), startDate: `${year}-01-05`, endDate: `${year}-12-11` })).data.id;
const termId = (await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: `${year}-01-05`, endDate: `${year}-12-11` })).data.id;
await admin.post(`/academics/terms/${termId}/set-current`);
const formOne = (await admin.post('/academics/classes', { className: 'Form One', code: 'F1', level: 'o_level' })).data.id;
const formTwo = (await admin.post('/academics/classes', { className: 'Form Two', code: 'F2', level: 'o_level' })).data.id;
r = await admin.post('/academics/streams', { classId: formOne, streamName: 'A', code: 'F1A', capacity: 3 });
const streamA = r.data.id;
await admin.post('/academics/streams', { classId: formOne, streamName: 'B', code: 'F1B' });
r = await admin.post('/users', { fullName: 'Asha Teacher', email: 'asha@school.ac.tz', role: 'teacher' });
const teacher = await signIn('asha@school.ac.tz', r.data.temporaryPassword, 'Teacher#2026a');

// ---- next registration number preview + relationship
r = await admin.get('/students/next-registration-number');
check('next number preview', r.status === 200 && r.data.registrationNumber === `S1819/${year}/001`, r);
r = await admin.get('/students/next-registration-number?admissionDate=2025-02-01');
check('preview follows admission year', r.data.registrationNumber === 'S1819/2025/001', r.data);
r = await teacher.get('/students/next-registration-number');
check('teacher cannot preview numbers', r.status === 403, r.status);
r = await admin.post('/students', { firstName: 'Kulwa', lastName: 'Kusekwa', gender: 'male', dob: '2012-05-01', classId: formTwo, parentName: 'kusekwa  kulwa', parentPhone: '0777 111 222', parentRelationship: 'Baba' });
const kulwa = r.data;
check('registered with S1819 and relationship', r.status === 201 && kulwa.registrationNumber === `S1819/${year}/001` && kulwa.parentRelationship === 'Baba', r);
check('preview moves on after saving', (await admin.get('/students/next-registration-number')).data.registrationNumber === `S1819/${year}/002`);
r = await admin.put(`/students/${kulwa.id}`, { parentRelationship: 'Mjomba' });
check('relationship editable', r.status === 200 && r.data.parentRelationship === 'Mjomba', r);
r = await admin.post('/students', { firstName: 'X', lastName: 'Y', gender: 'male', dob: '2012-05-01', classId: formTwo, parentName: 'Abc Def', parentPhone: '0777111222', parentRelationship: 'x'.repeat(41) });
check('relationship max length', r.status === 400 && r.error.details.parentRelationship, r);

// ---- SMS: guardian names in capitals
r = await admin.post('/sms/preview', { target: { type: 'students', studentIds: [kulwa.id] }, message: 'Mzazi {parent_name}, karibu.' });
check('SMS {parent_name} is UPPERCASE', r.status === 200 && r.data.samples[0].message === 'Mzazi KUSEKWA KULWA, karibu.', r.data?.samples);

// ---- import template
r = await admin.get('/students/import/template', { raw: true });
const lines = r.text.replace(/^\uFEFF/, '').trim().split(/\r\n/);
check('template is CSV with BOM', r.status === 200 && /text\/csv/.test(r.headers.get('content-type')) && r.text.charCodeAt(0) === 0xfeff, r.headers.get('content-type'));
check('template filename', /trifonia_student_import_template\.csv/.test(r.headers.get('content-disposition')), r.headers.get('content-disposition'));
check('template headers', lines[0] === 'First Name,Middle Name,Last Name,Gender,DOB,Class/Grade,Stream,Guardian Name,Guardian Phone,Relationship,Residence', lines[0]);
check('template sample row uses a real class', lines[1].includes('Form One') && lines[1].startsWith('Asha,'), lines[1]);
r = await teacher.get('/students/import/template', { raw: true });
check('teacher cannot download template', r.status === 403, r.status);

// ---- import preview
const header = lines[0].split(',');
const table = [
  header,
  lines[1].split(','), // sample row — must be rejected
  ['Juma', '', 'Ali', 'M', '2013-02-14', 'Form One', 'A', 'Ali Juma', '0777 333 444', 'Baba', 'Mwanakwerekwe'],
  ['Mwanaisha', 'Said', 'Omar', 'KE', '14/02/2013', 'form one', 'b', 'Said Omar', '255777555666', 'Mama', 'Fuoni'],
  ['Zawadi', '', 'Hamisi', 'F', '41319', 'F2', '', 'Hamisi Zawadi', '777888999', '', ''], // Excel serial date, class code, phone without 0
  ['Bakari', '', 'Nassor', 'M', '2013-07-01', 'Form Nine', '', 'Nassor Bakari', '0777 000 111', '', ''], // bad class
  ['Rehema', '', 'Khamis', 'F', '2013-07-01', 'Form One', 'C', 'Khamis Rehema', '0777 000 222', '', ''], // bad stream
  ['Salum', '', 'Abdalla', 'M', '2013-07-01', 'Form One', '', 'Abdalla Salum', '12345', '', ''], // bad phone
  ['', '', 'Haji', 'M', '2013-07-01', 'Form One', '', 'Haji Mzee', '0777 000 333', '', ''], // missing first name
  ['Juma', '', 'Ali', 'M', '2013-02-14', 'Form One', '', 'Ali Juma', '0777 333 444', '', ''], // duplicate of row 3
  ['Kulwa', '', 'Kusekwa', 'M', '2012-05-01', 'Form Two', '', 'Kusekwa Kulwa', '0777 111 222', '', ''], // already registered
  ['Neema', '', 'Juma', 'X', '2030-01-01', 'Form One', '', 'Juma Neema', '0777 000 444', '', ''], // bad gender + future dob
  ['Amani', '', 'Saidi', 'M', '2013-03-03', 'Form One', 'A', 'Saidi Amani', '0777 000 555', '', ''], // stream A seat 2
  ['Baraka', '', 'Saidi', 'M', '2013-03-04', 'Form One', 'A', 'Saidi Baraka', '0777 000 666', '', ''], // stream A seat 3
  ['Daudi', '', 'Saidi', 'M', '2013-03-05', 'Form One', 'A', 'Saidi Daudi', '0777 000 777', '', ''], // stream A full (capacity 3)
  ['', '', '', '', '', '', '', '', '', '', ''], // blank row ignored
];
r = await admin.post('/students/import', { table });
const byLine = Object.fromEntries((r.data?.rows ?? []).map((row) => [row.line, row]));
check('preview summary', r.status === 200 && r.data.summary.total === 14 && r.data.summary.valid === 5 && r.data.summary.invalid === 9, r.data?.summary ?? r);
check('sample row rejected', /sample row/.test(byLine[2]?.errors.firstName), byLine[2]);
check('valid row (gender M, ISO date)', byLine[3]?.valid && byLine[3].gender === 'male' && byLine[3].placement === 'Form One A', byLine[3]);
check('KE + dd/mm/yyyy + case-insensitive class/stream', byLine[4]?.valid && byLine[4].gender === 'female' && byLine[4].dob === '2013-02-14' && byLine[4].placement === 'Form One B', byLine[4]);
check('Excel serial date, class code, phone w/o 0', byLine[5]?.valid && byLine[5].dob === '2013-02-14' && byLine[5].placement === 'Form Two' && byLine[5].parentPhone === '255777888999', byLine[5]);
check('unknown class lists options', /No active class named "Form Nine".*Form One, Form Two/.test(byLine[6]?.errors.className), byLine[6]);
check('unknown stream lists options', /no stream "C". Use: A, B/.test(byLine[7]?.errors.streamName), byLine[7]);
check('bad phone flagged', Boolean(byLine[8]?.errors.parentPhone), byLine[8]);
check('missing first name flagged', Boolean(byLine[9]?.errors.firstName), byLine[9]);
check('duplicate inside file flagged', /Same student as row 3/.test(byLine[10]?.errors.firstName), byLine[10]);
check('already registered flagged', new RegExp(`Already registered as S1819/${year}/001`).test(byLine[11]?.errors.firstName), byLine[11]);
check('bad gender + future dob flagged', Boolean(byLine[12]?.errors.gender && byLine[12]?.errors.dob), byLine[12]);
check('stream capacity counted across the file', byLine[13]?.valid && byLine[14]?.valid && byLine[15]?.valid === false && /full \(capacity 3\)/.test(byLine[15]?.errors.streamName), [byLine[13], byLine[14], byLine[15]].map((row) => row?.errors));
check('blank row ignored', !byLine[16]);
check('preview saves nothing', (await query('SELECT COUNT(*) AS c FROM students'))[0].c === 1);

r = await admin.post('/students/import', { table: [['Name', 'Phone'], ['Juma', '0777']] });
check('missing columns explained', r.status === 400 && /missing these columns: First Name, Last Name, Gender, DOB, Class\/Grade, Guardian Name\. /.test(r.error.message), r.error);
r = await admin.post('/students/import', { table: [header] });
check('header only rejected', r.status === 400, r.status);
r = await admin.post('/students/import', { table: [header, ...Array.from({ length: 501 }, () => table[3])] });
check('more than 500 rows rejected', r.status === 400 && /at most 500/.test(r.error.message), r.error);
r = await teacher.post('/students/import', { table });
check('teacher cannot import', r.status === 403, r.status);
r = await admin.post('/students/import', { table: 'nope' });
check('non-grid body rejected', r.status === 400, r.status);
const swahili = [['Jina la Kwanza', 'Jina la Mwisho', 'Jinsia', 'Tarehe ya Kuzaliwa', 'Darasa', 'Jina la Mzazi', 'Simu'], ['Fatma', 'Ali', 'Ke', '2013-01-01', 'Form Two', 'Ali Fatma', '0777 999 000']];
r = await admin.post('/students/import', { table: swahili });
check('Swahili headers accepted', r.status === 200 && r.data.summary.valid === 1, r.data ?? r);

// ---- commit
r = await admin.post('/students/import', { table, commit: true });
const created = r.data?.created ?? [];
check('commit registers only valid rows', r.status === 201 && created.length === 5 && r.data.skipped === 9, r.data ?? r);
check('commit report: totals', r.data.total === 14 && r.data.imported === 5 && r.data.failed.length === 9, { total: r.data?.total, imported: r.data?.imported });
check('commit report: every failed row with line + reason', r.data.failed.map((row) => row.line).join(',') === '2,6,7,8,9,10,11,12,15'
  && r.data.failed.every((row) => row.message.startsWith(`Row ${row.line}: `) && row.reasons.length > 0), r.data?.failed);
check('commit report: readable reasons', r.data.failed.find((row) => row.line === 6)?.message.startsWith('Row 6: Class/Grade — No active class named "Form Nine"')
  && r.data.failed.find((row) => row.line === 9)?.reasons.includes('First Name — This field is required'), r.data?.failed?.filter((row) => [6, 9].includes(row.line)));
check('commit message summarises', r.message === '5 of 14 student(s) imported; 9 row(s) failed', r.message);
check('numbers sequential after the form registration', created.map((c) => c.registrationNumber).join(',') === [2, 3, 4, 5, 6].map((n) => `S1819/${year}/${String(n).padStart(3, '0')}`).join(','), created.map((c) => c.registrationNumber));
check('rows saved in file order', created.map((c) => c.line).join(',') === '3,4,5,13,14', created.map((c) => c.line));
const imported = await query("SELECT first_name AS f, parent_relationship AS rel, address, stream_id AS streamId FROM students WHERE first_name IN ('Juma', 'Mwanaisha')");
check('imported details stored (relationship, residence, stream)', imported.some((s) => s.f === 'Juma' && s.rel === 'Baba' && s.address === 'Mwanakwerekwe' && s.streamId === streamA), imported);
const [audit] = await query("SELECT details FROM audit_logs WHERE action = 'student.import'");
const details = typeof audit?.details === 'string' ? JSON.parse(audit.details) : audit?.details;
check('import audited', details?.imported === 5 && details.skipped === 9, details);
check('each student audited as student.register', (await query("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'student.register'"))[0].c === 6);
r = await admin.post('/students/import', { table, commit: true });
check('re-importing the same file adds nobody', r.status === 400 && (await query('SELECT COUNT(*) AS c FROM students'))[0].c === 6, r);

// ---- multipart uploads (the server parses CSV / XLSX itself)
const csvFile = (rows, name = 'wanafunzi.csv', type = 'text/csv') => {
  const form = new FormData();
  form.append('file', new Blob([String.fromCharCode(0xfeff) + rows.map((row) => row.join(';')).join('\r\n')], { type }), name);
  return form;
};
const freshRows = [
  header,
  ['Kassim', '', 'Hamad', 'M', '2013-05-05', 'Form Two', '', 'Hamad Kassim', '0777 555 101', 'Baba', 'Kiembe Samaki'],
  ['Lulu', '', 'Hamad', 'F', '2013-06-06', 'Form Nine', '', 'Hamad Lulu', '0777 555 102', '', ''],
  ['Omar', '', 'Faki', 'M', '2013-06-07', 'Form Two', '', 'Faki Omar', '', '', ''],
];
r = await admin.upload('/students/import', csvFile(freshRows));
check('multipart CSV preview (semicolons, BOM)', r.status === 200 && r.data.summary.total === 3 && r.data.summary.valid === 1, r.data?.summary ?? r);
check('preview lists failures in words', JSON.stringify(r.data?.failed?.map((row) => row.message)) === JSON.stringify([
  'Row 3: Class/Grade — No active class named "Form Nine". Use one of: Form One, Form Two',
  'Row 4: Guardian Phone — This field is required',
]), r.data?.failed);
check('preview saves nothing (multipart)', (await query("SELECT COUNT(*) AS c FROM students WHERE first_name = 'Kassim'"))[0].c === 0);
const commitForm = csvFile(freshRows);
commitForm.append('commit', 'true');
r = await admin.upload('/students/import', commitForm);
check('multipart commit report', r.status === 201 && r.data.total === 3 && r.data.imported === 1 && r.data.failed.length === 2
  && r.data.created[0].registrationNumber === `S1819/${year}/007` && r.message === '1 of 3 student(s) imported; 2 row(s) failed', r);

const xlsx = new FormData();
xlsx.append('file', new Blob([readFileSync(new URL('./fixtures/wanafunzi.xlsx', import.meta.url))]), 'wanafunzi.xlsx');
r = await admin.upload('/students/import', xlsx);
check('multipart XLSX parsed (deflate, shared strings, serial date, numeric phone)', r.status === 200 && r.data.summary.total === 2
  && r.data.rows[0].dob === '2013-08-14' && r.data.rows[0].parentPhone === '255777333555', r.data?.rows ?? r);
check('XLSX rows explained (streams that do not exist here)', r.data.failed.length === 2 && /Form Two has no streams/.test(r.data.failed[0].message) && /no stream "Red"/.test(r.data.failed[1].message), r.data?.failed);
xlsx.append('commit', 'true');
r = await admin.upload('/students/import', xlsx);
check('commit with nothing valid: 400 + full failure list', r.status === 400 && /None of the 2 row/.test(r.error.message) && r.error.details.failed.length === 2, r.error);

const bad = (content, name) => { const form = new FormData(); form.append('file', new Blob([content]), name); return form; };
r = await admin.upload('/students/import', bad('anything', 'old.xls'));
check('.xls explained', r.status === 400 && /Old \.xls files/.test(r.error.message), r.error);
r = await admin.upload('/students/import', bad('not a zip at all', 'broken.xlsx'));
check('corrupt .xlsx explained', r.status === 400 && /could not be read/.test(r.error.message), r.error);
r = await admin.upload('/students/import', bad('x', 'photo.png'));
check('other file types explained', r.status === 400 && /CSV or Excel/.test(r.error.message), r.error);
r = await admin.upload('/students/import', bad('a'.repeat(2 * 1024 * 1024 + 10), 'huge.csv'));
check('files over 2 MB rejected', r.status === 400 && /larger than 2 MB/.test(r.error.message), r.error);
r = await admin.upload('/students/import', new FormData());
check('no file explained', r.status === 400 && /"file" field/.test(r.error.message), r.error);
r = await teacher.upload('/students/import', csvFile(freshRows));
check('teacher cannot upload', r.status === 403, r.status);

console.log(`\nPhase 9: ${passed} passed, ${failed} failed`);
server.close();
await closePool();
process.exit(failed ? 1 : 0);
