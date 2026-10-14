import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { parsePagination } from '../../utils/pagination.js';
import { optionalId, parseId, validator } from '../../utils/validator.js';
import * as studentsService from './students.service.js';

const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u;
const NAME_MESSAGE = 'Use letters, spaces, apostrophes or hyphens only';

function validateStudent(body, { partial = false } = {}) {
  const today = todayInSchoolTz();
  const v = validator(body, { partial })
    .string('firstName', { required: true, max: 60, pattern: NAME_PATTERN, patternMessage: NAME_MESSAGE })
    .string('middleName', { max: 60, pattern: NAME_PATTERN, patternMessage: NAME_MESSAGE })
    .string('lastName', { required: true, max: 60, pattern: NAME_PATTERN, patternMessage: NAME_MESSAGE })
    .oneOf('gender', ['male', 'female'], { required: true })
    .date('dob', { required: true, notAfter: today, notBefore: '1950-01-01' })
    .id('classId', { required: true })
    .id('streamId')
    .string('parentName', { required: true, min: 3, max: 150 })
    .phone('parentPhone', { required: true })
    .id('parentUserId')
    .string('address', { max: 255 })
    .date('admissionDate', { notAfter: today, notBefore: '1990-01-01' });

  if (partial) {
    v.oneOf('status', studentsService.STUDENT_STATUSES).string('statusReason', { max: 255 });
  }
  return v
    .rule('dob', (data) => (data.dob && data.admissionDate && data.dob >= data.admissionDate
      ? 'Date of birth must be before the admission date'
      : null))
    .result();
}

export const listStudents = asyncHandler(async (req, res) => {
  const { status, search, sort, dir } = req.query;
  if (status && !studentsService.STUDENT_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter');
  const filters = {
    classId: optionalId(req.query.classId, 'classId'),
    streamId: optionalId(req.query.streamId, 'streamId'),
    status,
    search: typeof search === 'string' ? search.trim().slice(0, 100) : '',
    sort,
    dir,
  };
  const result = await studentsService.listStudents(filters, parsePagination(req.query), req.user);
  res.json({ success: true, data: result });
});

export const registerStudent = asyncHandler(async (req, res) => {
  const student = await studentsService.registerStudent(validateStudent(req.body), auditContext(req));
  res.status(201).json({ success: true, data: student, message: `Student registered as ${student.registrationNumber}` });
});

export const getStudent = asyncHandler(async (req, res) => {
  const profile = await studentsService.getStudentProfile(parseId(req.params.id), req.user);
  res.json({ success: true, data: profile });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentsService.updateStudent(
    parseId(req.params.id),
    validateStudent(req.body, { partial: true }),
    auditContext(req),
  );
  res.json({ success: true, data: student });
});
