import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { optionalId, parseId, validator } from '../../utils/validator.js';
import * as examsService from './exams.service.js';

const MAX_BULK_ENTRIES = 500;

function validateExam(body, { partial = false } = {}) {
  const v = validator(body, { partial })
    .string('name', { required: true, min: 3, max: 100 })
    .oneOf('examType', examsService.EXAM_TYPES, { required: true })
    .id('termId', { required: true })
    .date('startDate')
    .date('endDate')
    .number('maxScore', { min: 1, max: 100, decimals: 2 });
  if (partial) v.oneOf('status', examsService.EXAM_STATUSES);
  return v.result();
}

function validateBulkMarks(body = {}) {
  const target = validator(body)
    .id('examId', { required: true })
    .id('subjectId', { required: true })
    .id('classId', { required: true })
    .id('streamId')
    .result();

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw ApiError.badRequest('Please correct the highlighted fields', { entries: 'At least one entry is required' });
  }
  if (body.entries.length > MAX_BULK_ENTRIES) {
    throw ApiError.badRequest(`A maximum of ${MAX_BULK_ENTRIES} entries can be saved at once`);
  }

  const errors = {};
  const seen = new Set();
  const entries = [];
  body.entries.forEach((raw, index) => {
    try {
      const entry = validator(raw)
        .id('studentId', { required: true })
        .boolean('isAbsent')
        .number('score', { min: 0, max: 100, decimals: 2 })
        .string('remarks', { max: 255 })
        .result();
      if (seen.has(entry.studentId)) {
        errors[`entries.${index}.studentId`] = 'Duplicate student in this submission';
        return;
      }
      seen.add(entry.studentId);
      entries.push({
        studentId: entry.studentId,
        isAbsent: entry.isAbsent ?? false,
        score: entry.isAbsent ? null : (entry.score ?? null),
        remarks: entry.remarks,
      });
    } catch (error) {
      for (const [field, message] of Object.entries(error.details || {})) {
        errors[`entries.${index}.${field}`] = message;
      }
    }
  });
  if (Object.keys(errors).length > 0) throw ApiError.badRequest('Some entries are invalid', errors);
  return { ...target, entries };
}

function classTarget(query) {
  return {
    classId: parseId(query.classId, 'classId'),
    streamId: optionalId(query.streamId, 'streamId'),
  };
}

export const listExams = asyncHandler(async (req, res) => {
  const { status } = req.query;
  if (status && !examsService.EXAM_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter');
  const exams = await examsService.listExams({
    termId: optionalId(req.query.termId, 'termId'),
    academicYearId: optionalId(req.query.academicYearId, 'academicYearId'),
    status,
  }, req.user);
  res.json({ success: true, data: exams });
});

export const getExam = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await examsService.findExam(parseId(req.params.id), req.user) });
});

export const createExam = asyncHandler(async (req, res) => {
  const exam = await examsService.createExam(validateExam(req.body), req.user, auditContext(req));
  res.status(201).json({ success: true, data: exam });
});

export const updateExam = asyncHandler(async (req, res) => {
  const exam = await examsService.updateExam(
    parseId(req.params.id),
    validateExam(req.body, { partial: true }),
    auditContext(req),
  );
  res.json({ success: true, data: exam });
});

export const deleteExam = asyncHandler(async (req, res) => {
  await examsService.deleteExam(parseId(req.params.id), auditContext(req));
  res.json({ success: true, message: 'Exam deleted' });
});

export const getMarksheet = asyncHandler(async (req, res) => {
  const sheet = await examsService.getMarksheet(parseId(req.params.id), {
    ...classTarget(req.query),
    subjectId: parseId(req.query.subjectId, 'subjectId'),
  }, req.user);
  res.json({ success: true, data: sheet });
});

export const saveBulkMarks = asyncHandler(async (req, res) => {
  const result = await examsService.saveBulkMarks(validateBulkMarks(req.body), req.user, auditContext(req));
  const changed = result.inserted + result.updated + result.cleared;
  res.json({ success: true, data: result, message: changed ? `${changed} mark(s) saved` : 'No changes to save' });
});

export const getResults = asyncHandler(async (req, res) => {
  const results = await examsService.getResults(parseId(req.params.id), classTarget(req.query), req.user);
  res.json({ success: true, data: results });
});
