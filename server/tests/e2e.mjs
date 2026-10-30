// End-to-end API test against the throwaway MySQL on 3307. Usage: node e2e.mjs <serverDir>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const serverDir = process.argv[2];
const scratch = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const testEnv = {
  NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '',
  DB_NAME: `sms_e2e_${Date.now()}`, JWT_SECRET: 'e'.repeat(64), CORS_ORIGINS: 'http://localhost:5173',
  COOKIE_SECURE: 'false', COOKIE_SAMESITE: 'strict', SCHOOL_NAME: 'Al-Noor Academy Zanzibar',
  SCHOOL_REGISTRATION_NO: 'ZEC/PS/0142', SCHOOL_ADDRESS: 'P.O. Box 1234, Mombasa Road, Zanzibar',
  SCHOOL_PHONE: '+255 24 223 0000', SCHOOL_EMAIL: 'info@alnoor.ac.tz', SCHOOL_MOTTO: 'Knowledge is Light',
  RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_MAX: '1000',
};
Object.assign(process.env, testEnv);
const run = (script, args = []) => execFileSync(process.execPath, [path.join(serverDir, script), ...args], {
  env: { ...process.env }, cwd: serverDir, encoding: 'utf8',
});

let passed = 0;
let failed = 0;
function check(name, condition, extra) {
  if (condition) passed += 1;
  else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); }
}

console.log(run('src/scripts/migrate.js'));
console.log('re-run:', run('src/scripts/migrate.js').split('\n').filter((l) => l.includes('migration')).join(' '));
const adminOut = run('src/scripts/createAdmin.js', ['--name', 'Head Master', '--email', 'head@alnoor.ac.tz', '--phone', '0777000001']);
const adminTemp = adminOut.match(/Temporary password: (\S+)/)[1];

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
    const json = await res.json();
    return { status: res.status, ...json };
  };
  return {
    get: (u) => call('GET', u), post: (u, b) => call('POST', u, b), put: (u, b) => call('PUT', u, b),
    del: (u) => call('DELETE', u), raw: (u) => call('GET', u, null, { raw: true }),
  };
}

async function signIn(identifier, temp, finalPassword) {
  const s = session();
  let r = await s.post('/auth/login', { identifier, password: temp });
  check(`login ${identifier}`, r.status === 200, r);
  if (r.data?.user?.mustChangePassword) {
    r = await s.get('/dashboard/summary');
    check('blocked until password change', r.status === 403 && r.error.code === 'PASSWORD_CHANGE_REQUIRED', r);
    r = await s.post('/auth/change-password', { currentPassword: temp, newPassword: finalPassword, confirmPassword: finalPassword });
    check('change password', r.status === 200, r);
  }
  return s;
}

const admin = await signIn('head@alnoor.ac.tz', adminTemp, 'Headmaster#2026');

// ---- calendar
let r = await admin.post('/academics/years', { yearLabel: '2026', startDate: '2026-01-05', endDate: '2026-12-11' });
check('create year', r.status === 201, r);
const yearId = r.data.id;
r = await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term I', termNumber: 1, startDate: '2026-01-05', endDate: '2026-04-03' });
check('create term', r.status === 201, r);
const termId = r.data.id;
r = await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Term II', termNumber: 2, startDate: '2026-04-20', endDate: '2026-08-07' });
const term2Id = r.data.id;
r = await admin.post('/academics/terms', { academicYearId: yearId, termName: 'Bad', termNumber: 3, startDate: '2025-04-20', endDate: '2026-08-07' });
check('term outside year rejected', r.status === 400, r);
r = await admin.post(`/academics/terms/${termId}/set-current`);
check('set current term', r.status === 200 && r.data.term.id === termId && r.data.academicYear.id === yearId, r);
r = await admin.post(`/academics/terms/${term2Id}/set-current`);
r = await admin.post(`/academics/terms/${termId}/set-current`);
check('toggle current term', r.data.term.id === termId, r);
r = await admin.get('/academics/years');
check('list years nested terms', r.data[0].terms.length === 2 && r.data[0].isCurrent === true, r);

// ---- classes, streams, subjects
r = await admin.post('/academics/classes', { className: 'Form One', code: 'f1', level: 'o_level', sortOrder: 1 });
check('create class', r.status === 201 && r.data.code === 'F1', r);
const classId = r.data.id;
r = await admin.post('/academics/classes', { className: 'Form One', code: 'F1X', level: 'o_level' });
check('duplicate class 409', r.status === 409, r);
r = await admin.post('/academics/streams', { classId, streamName: 'A', code: 'F1A', capacity: 40 });
const streamA = r.data.id;
check('create stream', r.status === 201, r);
r = await admin.post('/academics/streams', { classId, streamName: 'B', code: 'F1B', capacity: 2 });
const streamB = r.data.id;
r = await admin.post('/academics/classes', { className: 'Standard Five', code: 'STD5', level: 'primary', sortOrder: 5 });
const primaryClassId = r.data.id;

const subjectDefs = [
  ['Mathematics', 'MATH'], ['English Language', 'ENG'], ['Kiswahili', 'KISW'], ['Biology', 'BIO'],
  ['Chemistry', 'CHEM'], ['Physics', 'PHY'], ['Geography', 'GEO'], ['History', 'HIST'], ['Islamic Knowledge', 'ISK'],
];
const subjectIds = [];
for (const [name, code] of subjectDefs) {
  r = await admin.post('/academics/subjects', { name, code, level: 'o_level' });
  check(`subject ${code}`, r.status === 201, r);
  subjectIds.push(r.data.id);
}
r = await admin.post('/academics/subjects', { name: 'Mathematics', code: 'PMATH', level: 'primary' });
const primaryMath = r.data.id;
r = await admin.get('/academics/classes');
check('list classes with streams', r.data.find((c) => c.id === classId).streams.length === 2, r);

// ---- users
r = await admin.post('/users', { fullName: 'Asha Juma', email: 'asha@alnoor.ac.tz', role: 'teacher' });
check('create teacher', r.status === 201 && r.data.temporaryPassword, r);
const teacherId = r.data.user.id;
const teacherTemp = r.data.temporaryPassword;
r = await admin.post('/users', { fullName: 'Omar Said', phone: '0715 222 333', role: 'teacher' });
const teacher2Id = r.data.user.id;
const teacher2Temp = r.data.temporaryPassword;
r = await admin.post('/users', { fullName: 'Mzee Bakari', phone: '0777 444 555', role: 'parent' });
const parentId = r.data.user.id;
const parentTemp = r.data.temporaryPassword;
r = await admin.post('/users', { fullName: 'Fatma Bursar', email: 'bursar@alnoor.ac.tz', role: 'accountant' });
const accountantTemp = r.data.temporaryPassword;
r = await admin.post('/users', { fullName: 'No Contact', role: 'teacher' });
check('user needs contact', r.status === 400, r);
r = await admin.get('/users?role=teacher');
check('list teachers', r.data.items.length === 2, r);
r = await admin.put(`/users/${1}`, { status: 'inactive' });
check('cannot deactivate self', r.status === 403, r);

r = await admin.put(`/academics/classes/${classId}`, { classTeacherId: teacherId });
check('set class teacher', r.data.classTeacherId === teacherId, r);

// assignments: teacher1 = MATH class-wide + ENG stream A; teacher2 = ENG stream B + rest class-wide
r = await admin.post('/academics/assignments', { teacherId, subjectId: subjectIds[0], classId });
check('assign class-wide', r.status === 201, r);
r = await admin.post('/academics/assignments', { teacherId, subjectId: subjectIds[1], classId, streamId: streamA });
check('assign stream', r.status === 201, r);
r = await admin.post('/academics/assignments', { teacherId: teacher2Id, subjectId: subjectIds[1], classId });
check('overlap rejected', r.status === 409, r);
r = await admin.post('/academics/assignments', { teacherId: teacher2Id, subjectId: subjectIds[1], classId, streamId: streamB });
for (const sid of subjectIds.slice(2)) await admin.post('/academics/assignments', { teacherId: teacher2Id, subjectId: sid, classId });
r = await admin.post('/academics/assignments', { teacherId, subjectId: primaryMath, classId });
check('level mismatch rejected', r.status === 400, r);
r = await admin.get('/academics/assignments');
check('list assignments', r.data.length === 10, r.data?.length);

// ---- students
const people = [
  ['Amina', 'Hamad', 'Said', 'female', streamA], ['Juma', null, 'Ali', 'male', streamA], ['Zuhura', 'Khamis', 'Mussa', 'female', streamA],
  ['Salim', null, 'Othman', 'male', streamB], ['Rehema', null, 'Abdalla', 'female', streamB],
];
const studentIds = [];
for (const [firstName, middleName, lastName, gender, streamId] of people) {
  r = await admin.post('/students', {
    firstName, middleName, lastName, gender, dob: '2012-03-14', classId, streamId,
    parentName: 'Mzee Bakari', parentPhone: '+255 777-444-555', admissionDate: '2026-01-06',
    parentUserId: firstName === 'Amina' ? parentId : undefined,
  });
  check(`register ${firstName}`, r.status === 201, r);
  studentIds.push(r.data?.id);
}
check('reg number format (S1819 prefix)', /^S1819\/2026\/001$/.test((await admin.get(`/students/${studentIds[0]}`)).data.student.registrationNumber));
r = await admin.post('/students', {
  firstName: 'Extra', lastName: 'Kid', gender: 'male', dob: '2012-01-01', classId, streamId: streamB,
  parentName: 'Someone', parentPhone: '0777123456',
});
check('stream capacity enforced', r.status === 409, r);
r = await admin.post('/students', { firstName: 'X1', lastName: 'Y', gender: 'm', dob: '2030-01-01', classId, parentName: 'P', parentPhone: '123' });
check('student validation errors', r.status === 400 && r.error.details.parentPhone && r.error.details.dob && r.error.details.gender, r);
r = await admin.get(`/students?classId=${classId}&search=amina&pageSize=2`);
check('search students', r.data.items.length === 1 && r.data.items[0].parentPhone === '255777444555', r);
r = await admin.get(`/students?classId=${classId}&sort=regNo&dir=desc&pageSize=2&page=2`);
check('paginate students', r.data.pagination.total === 5 && r.data.pagination.totalPages === 3 && r.data.items.length === 2, r);
r = await admin.put(`/students/${studentIds[4]}`, { status: 'graduated', statusReason: 'test' });
check('active->graduated ok', r.status === 200 && r.data.status === 'graduated', r);
r = await admin.put(`/students/${studentIds[4]}`, { status: 'active' });
check('graduated is final', r.status === 400, r);
r = await admin.put(`/students/${studentIds[3]}`, { status: 'suspended' });
r = await admin.put(`/students/${studentIds[3]}`, { status: 'active', middleName: 'Hassan' });
check('suspended->active + bio', r.status === 200 && r.data.middleName === 'Hassan', r);
r = await admin.put(`/students/${studentIds[4]}`, { status: 'graduated' });

// ---- exams
r = await admin.post('/exams', { name: 'Midterm Examination', examType: 'midterm', termId, startDate: '2026-02-16', endDate: '2026-02-20' });
check('create exam', r.status === 201 && r.data.status === 'draft' && r.data.academicYearId === yearId, r);
const examId = r.data.id;
r = await admin.post('/exams', { name: 'Bad Dates', examType: 'quiz', termId, startDate: '2026-06-01' });
check('exam dates within term', r.status === 400, r);
r = await admin.put(`/exams/${examId}`, { status: 'published' });
check('invalid exam transition', r.status === 400, r);
r = await admin.put(`/exams/${examId}`, { status: 'open' });
check('open exam', r.data.status === 'open', r);

const teacher = await signIn('asha@alnoor.ac.tz', teacherTemp, 'Teacher#2026a');
const teacher2 = await signIn('0715222333', teacher2Temp, 'Teacher#2026b');

r = await teacher.get('/academics/assignments');
check('teacher sees own assignments', r.data.length === 2 && r.data.every((a) => a.teacherId === teacherId), r);
r = await teacher.get(`/exams/${examId}/marksheet?classId=${classId}&subjectId=${subjectIds[0]}`);
check('teacher marksheet', r.status === 200 && r.data.students.length === 4 && r.data.canEdit, r);
r = await teacher.get(`/exams/${examId}/marksheet?classId=${classId}&subjectId=${subjectIds[2]}`);
check('teacher not assigned 403', r.status === 403, r);
r = await teacher.get(`/exams/${examId}/marksheet?classId=${classId}&subjectId=${subjectIds[1]}`);
check('stream-only teacher needs stream', r.status === 403, r);
r = await teacher.get(`/exams/${examId}/marksheet?classId=${classId}&streamId=${streamA}&subjectId=${subjectIds[1]}`);
check('stream marksheet', r.status === 200 && r.data.students.length === 3, r);

// marks: deterministic scores
const scores = {
  [studentIds[0]]: [88, 79, 92, 75, 81, 70, 77, 85, 90],
  [studentIds[1]]: [45, 52, 60, 38, 41, 29, 55, 62, 70],
  [studentIds[2]]: [66, 71, 58, 64, 49, 52, 68, 74, 80],
  [studentIds[3]]: [20, 25, 21, 18, 15, 22, 28, 35, 10],
};
r = await teacher.post('/exams/marks/bulk', {
  examId, subjectId: subjectIds[0], classId,
  entries: studentIds.slice(0, 4).map((id) => ({ studentId: id, score: scores[id][0], remarks: id === studentIds[0] ? 'Outstanding work' : '' })),
});
check('teacher bulk save', r.status === 200 && r.data.inserted === 4, r);
r = await teacher.post('/exams/marks/bulk', {
  examId, subjectId: subjectIds[0], classId,
  entries: [{ studentId: studentIds[0], score: 120 }],
});
check('score > max rejected', r.status === 400, r);
r = await teacher.post('/exams/marks/bulk', {
  examId, subjectId: subjectIds[0], classId,
  entries: [{ studentId: studentIds[4], score: 50 }],
});
check('graduated/out-of-class student rejected', r.status === 400, r);
r = await teacher.post('/exams/marks/bulk', {
  examId, subjectId: subjectIds[1], classId, streamId: streamA,
  entries: studentIds.slice(0, 3).map((id) => ({ studentId: id, score: scores[id][1] })),
});
check('stream bulk save', r.status === 200 && r.data.inserted === 3, r);
r = await teacher2.post('/exams/marks/bulk', {
  examId, subjectId: subjectIds[1], classId, streamId: streamB,
  entries: [{ studentId: studentIds[3], score: scores[studentIds[3]][1] }],
});
check('teacher2 stream B save', r.status === 200, r);
for (let i = 2; i < subjectIds.length; i += 1) {
  r = await teacher2.post('/exams/marks/bulk', {
    examId, subjectId: subjectIds[i], classId,
    entries: studentIds.slice(0, 4).map((id) => (i === 5 && id === studentIds[1]
      ? { studentId: id, isAbsent: true }
      : { studentId: id, score: scores[id][i] })),
  });
  check(`subject ${i} save`, r.status === 200, r);
}
// edit + unchanged + clear
r = await teacher.post('/exams/marks/bulk', {
  examId, subjectId: subjectIds[0], classId,
  entries: [{ studentId: studentIds[0], score: 89.5, remarks: 'Outstanding work' }, { studentId: studentIds[1], score: 45, remarks: '' }],
});
check('update + unchanged', r.data.updated === 1 && r.data.unchanged === 1, r.data && { u: r.data.updated, n: r.data.unchanged });

r = await admin.get(`/exams/${examId}/results?classId=${classId}`);
check('results', r.status === 200 && r.data.students.length === 4, r);
const top = r.data.students[0];
check('rank 1 is Amina', top.studentId === studentIds[0] && top.classPosition === 1 && top.overall.value === 'I', top);
const juma = r.data.students.find((s) => s.studentId === studentIds[1]);
check('absent subject handled', juma.subjects.find((s) => s.subjectId === subjectIds[5]).grade === 'ABS' && juma.subjectsSat === 8, juma);
const salim = r.data.students.find((s) => s.studentId === studentIds[3]);
check('fail division 0', salim.overall.value === '0' && salim.overall.remark === 'Fail' && salim.streamPosition === 1, salim.overall);
check('statistics', r.data.statistics.ranked === 4 && r.data.statistics.passRate === 75, r.data.statistics);
console.log('   division sample:', r.data.students.map((s) => `${s.fullName}: avg ${s.averagePct} div ${s.overall.value}(${s.overall.points}) pos ${s.classPosition}/${s.classSize} stream ${s.streamPosition}/${s.streamSize}`).join(' | '));
r = await admin.get(`/exams/${examId}/results?classId=${classId}&streamId=${streamB}`);
check('stream-filtered results keep class position', r.data.students.length === 1 && r.data.students[0].classPosition === 4, r.data.students);
r = await teacher.get(`/exams/${examId}/results?classId=${primaryClassId}`);
check('teacher results other class 403', r.status === 403, r);

// ---- reports
r = await teacher.put('/reports/remarks', { examId, studentId: studentIds[0], classTeacherRemark: 'Excellent performance. Keep it up!' });
check('class teacher remark', r.status === 200, r);
r = await teacher2.put('/reports/remarks', { examId, studentId: studentIds[0], classTeacherRemark: 'nope' });
check('non class teacher remark 403', r.status === 403, r);
r = await teacher.put('/reports/remarks', { examId, studentId: studentIds[0], headmasterRemark: 'nope' });
check('teacher cannot write headmaster remark', r.status === 403, r);
r = await admin.put('/reports/remarks', { examId, studentId: studentIds[0], headmasterRemark: 'Well done. Promoted with distinction.' });
check('headmaster remark', r.status === 200 && r.data.classTeacherRemark.startsWith('Excellent'), r);
r = await admin.get(`/reports/students/${studentIds[0]}/report-card?examId=${examId}`);
check('report data', r.status === 200 && r.data.result.classPosition === 1 && r.data.result.subjects[0].teacherName, r);
r = await admin.raw(`/reports/students/${studentIds[0]}/report-card.pdf?examId=${examId}`);
check('pdf download', r.status === 200 && r.headers.get('content-type') === 'application/pdf' && r.buffer.subarray(0, 4).toString() === '%PDF', r.status);
writeFileSync(path.join(scratch, 'report-card.pdf'), r.buffer);
r = await teacher.raw(`/reports/classes/${classId}/report-cards.pdf?examId=${examId}`);
check('class pdf', r.status === 200 && r.buffer.subarray(0, 4).toString() === '%PDF', r.status);
writeFileSync(path.join(scratch, 'class-report-cards.pdf'), r.buffer);

const parent = await signIn('0777444555', parentTemp, 'Parent#2026x');
r = await parent.get(`/reports/students/${studentIds[0]}/available`);
check('parent sees no unpublished', r.status === 200 && r.data.length === 0, r);
r = await parent.get(`/reports/students/${studentIds[1]}/available`);
check('parent other child 404', r.status === 404, r);
r = await admin.put(`/exams/${examId}`, { status: 'closed' });
r = await teacher.post('/exams/marks/bulk', { examId, subjectId: subjectIds[0], classId, entries: [{ studentId: studentIds[0], score: 10 }] });
check('closed exam locks marks', r.status === 409, r);
r = await admin.put(`/exams/${examId}`, { status: 'published' });
check('publish', r.data.status === 'published', r);
r = await parent.get(`/reports/students/${studentIds[0]}/available`);
check('parent sees published', r.data.length === 1, r);
r = await parent.raw(`/reports/students/${studentIds[0]}/report-card.pdf?examId=${examId}`);
check('parent pdf', r.status === 200, r.status);
r = await parent.get('/students');
check('parent list scoped', r.data.items.length === 1 && r.data.items[0].id === studentIds[0], r);
r = await parent.get(`/students/${studentIds[0]}`);
check('parent profile with fees + performance', r.status === 200 && r.data.fees && r.data.performance.length === 1, r);
r = await parent.get(`/students/${studentIds[1]}`);
check('parent cannot view other student', r.status === 404, r);
r = await parent.get('/exams');
check('parent cannot list exams', r.status === 403, r);

r = await teacher.get('/students');
check('teacher student scope', r.status === 200 && r.data.pagination.total === 5, r);
r = await admin.get(`/students/${studentIds[0]}`);
check('admin profile', r.data.performance[0].classPosition === 1 && r.data.performance[0].grade && Array.isArray(r.data.allowedStatusTransitions), r);

const accountant = await signIn('bursar@alnoor.ac.tz', accountantTemp, 'Bursar#2026zz');
r = await accountant.get('/students');
check('accountant can list students', r.status === 200, r);
r = await accountant.post('/students', {});
check('accountant cannot register', r.status === 403, r);
r = await accountant.get(`/students/${studentIds[0]}`);
check('accountant profile no performance', r.status === 200 && r.data.performance.length === 0 && r.data.fees, r);

for (const [label, s] of [['admin', admin], ['teacher', teacher], ['accountant', accountant], ['parent', parent]]) {
  r = await s.get('/dashboard/summary');
  check(`dashboard ${label}`, r.status === 200 && r.data.role === label, r);
  if (label === 'admin') check('admin pass rate', r.data.performance.passRate === 75 && r.data.metrics.activeStudents === 4, r.data);
  if (label === 'parent') check('parent child latest', r.data.children[0].latestReport?.examId === examId, r.data);
}

r = await admin.put(`/users/${teacherId}`, { role: 'accountant' });
check('role change blocked while assigned', r.status === 409, r);
r = await admin.post(`/users/${teacher2Id}/reset-password`);
check('reset password', r.status === 200 && r.data.temporaryPassword, r);
r = await teacher2.get('/dashboard/summary');
check('reset revokes session', r.status === 401, r);
r = await admin.del(`/academics/classes/${classId}`);
check('delete class in use 409', r.status === 409, r);
r = await admin.del(`/exams/${examId}`);
check('delete exam with marks 409', r.status === 409, r);

console.log(`\n${passed} passed, ${failed} failed`);
server.close();
await closePool();
process.exit(failed ? 1 : 0);
