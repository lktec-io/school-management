import { validator } from '../../utils/validator.js';

export const LEVELS = ['nursery', 'primary', 'o_level', 'a_level'];

const CODE_PATTERN = /^[A-Za-z0-9-]+$/;
const CODE_MESSAGE = 'Use letters, numbers and hyphens only';
const upper = (value) => value.toUpperCase();

export function validateYear(body, { partial = false } = {}) {
  return validator(body, { partial })
    .string('yearLabel', { required: true, max: 20, pattern: /^\d{4}(\/\d{4})?$/, patternMessage: 'Use 2026 or 2026/2027' })
    .date('startDate', { required: true })
    .date('endDate', { required: true })
    .result();
}

export function validateTerm(body, { partial = false } = {}) {
  const v = validator(body, { partial });
  if (!partial) v.id('academicYearId', { required: true });
  return v
    .string('termName', { required: true, max: 50 })
    .integer('termNumber', { required: true, min: 1, max: 4 })
    .date('startDate', { required: true })
    .date('endDate', { required: true })
    .result();
}

export function validateClass(body, { partial = false } = {}) {
  return validator(body, { partial })
    .string('className', { required: true, max: 50 })
    .string('code', { required: true, max: 20, pattern: CODE_PATTERN, patternMessage: CODE_MESSAGE, transform: upper })
    .oneOf('level', LEVELS, { required: true })
    .integer('sortOrder', { min: 0, max: 999 })
    .id('classTeacherId')
    .boolean('isActive')
    .result();
}

export function validateStream(body, { partial = false } = {}) {
  const v = validator(body, { partial });
  if (!partial) v.id('classId', { required: true });
  return v
    .string('streamName', { required: true, max: 30 })
    .string('code', { required: true, max: 20, pattern: CODE_PATTERN, patternMessage: CODE_MESSAGE, transform: upper })
    .integer('capacity', { min: 1, max: 500 })
    .boolean('isActive')
    .result();
}

export function validateSubject(body, { partial = false } = {}) {
  return validator(body, { partial })
    .string('name', { required: true, max: 80 })
    .string('code', { required: true, max: 20, pattern: CODE_PATTERN, patternMessage: CODE_MESSAGE, transform: upper })
    .oneOf('level', LEVELS, { required: true })
    .boolean('isCore')
    .boolean('isActive')
    .result();
}

export function validateAssignment(body) {
  return validator(body)
    .id('teacherId', { required: true })
    .id('subjectId', { required: true })
    .id('classId', { required: true })
    .id('streamId')
    .id('academicYearId')
    .result();
}

export function validateAssignmentUpdate(body) {
  return validator(body).id('teacherId', { required: true }).result();
}
