import { todayInSchoolTz } from '../../utils/dates.js';
import { validator } from '../../utils/validator.js';
import { STUDENT_STATUSES } from './students.service.js';

const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u;
const NAME_MESSAGE = 'Use letters, spaces, apostrophes or hyphens only';

export function validateStudent(body, { partial = false } = {}) {
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
    .string('parentRelationship', { max: 40 })
    .id('parentUserId')
    .string('address', { max: 255 })
    .date('admissionDate', { notAfter: today, notBefore: '1990-01-01' });

  if (partial) {
    v.oneOf('status', STUDENT_STATUSES).string('statusReason', { max: 255 });
  }
  return v
    .rule('dob', (data) => (data.dob && data.admissionDate && data.dob >= data.admissionDate
      ? 'Date of birth must be before the admission date'
      : null))
    .result();
}
