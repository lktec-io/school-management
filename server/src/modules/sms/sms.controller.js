import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { parsePagination } from '../../utils/pagination.js';
import { isValidIsoDate, validator } from '../../utils/validator.js';
import * as sms from './sms.service.js';

const CATEGORIES = ['fee_reminder', 'payment_receipt', 'results', 'announcement', 'other'];
const STATUSES = ['queued', 'sent', 'failed', 'delivered'];

function idList(value, field, { max = 3000 } = {}) {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map(Number))];
  if (ids.length > max || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw ApiError.badRequest('Please correct the highlighted fields', { [field]: 'Invalid list of IDs' });
  }
  return ids;
}

function validateBroadcast(body = {}) {
  const { message, category } = validator(body)
    .string('message', { required: true, min: 2, max: 1000, multiline: true })
    .oneOf('category', CATEGORIES)
    .result();
  const raw = body.target && typeof body.target === 'object' ? body.target : {};
  const target = validator(raw)
    .oneOf('type', sms.TARGET_TYPES, { required: true })
    .id('classId')
    .id('streamId')
    .id('termId')
    .id('examId')
    .number('minBalance', { min: 0, max: 1_000_000_000 })
    .rule('classId', (values) => (['class', 'exam_results'].includes(values.type) && !values.classId ? 'Select a class' : null))
    .rule('examId', (values) => (values.type === 'exam_results' && !values.examId ? 'Select an examination' : null))
    .result();
  target.studentIds = idList(raw.studentIds, 'studentIds');
  if (target.type === 'students' && !target.studentIds?.length) {
    throw ApiError.badRequest('Please correct the highlighted fields', { studentIds: 'Select at least one student' });
  }
  if (target.type === 'custom') {
    const phones = Array.isArray(raw.phones) ? raw.phones.map((p) => String(p).trim()).filter(Boolean) : [];
    if (phones.length === 0 || phones.length > 3000) {
      throw ApiError.badRequest('Please correct the highlighted fields', { phones: 'Enter between 1 and 3000 phone numbers' });
    }
    target.phones = phones;
  }
  return { target, message, category };
}

export const preview = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await sms.previewBroadcast(validateBroadcast(req.body), req.user) });
});

export const sendBulk = asyncHandler(async (req, res) => {
  const result = await sms.sendBroadcast(validateBroadcast(req.body), req.user, auditContext(req));
  res.status(202).json({
    success: true,
    data: result,
    message: `${result.queued} message(s) queued for delivery${result.failed ? `, ${result.failed} skipped (invalid number)` : ''}`,
  });
});

export const logs = asyncHandler(async (req, res) => {
  const { status, category, batchId, dateFrom, dateTo, search } = req.query;
  if (status && !STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter');
  if (category && !CATEGORIES.includes(category)) throw ApiError.badRequest('Invalid category filter');
  if ((dateFrom && !isValidIsoDate(dateFrom)) || (dateTo && !isValidIsoDate(dateTo))) throw ApiError.badRequest('Invalid date filter');
  if (batchId && !/^[0-9a-f-]{36}$/i.test(batchId)) throw ApiError.badRequest('Invalid batch filter');
  res.json({
    success: true,
    data: await sms.listLogs({
      status, category, batchId, dateFrom, dateTo, search: typeof search === 'string' ? search.trim().slice(0, 100) : '',
    }, parsePagination(req.query, { defaultPageSize: 50, maxPageSize: 200 })),
  });
});

export const retry = asyncHandler(async (req, res) => {
  const ids = idList(req.body?.ids, 'ids', { max: 500 });
  if (!ids?.length) throw ApiError.badRequest('Select at least one failed message to retry');
  const result = await sms.retry(ids, req.user, auditContext(req));
  res.status(202).json({ success: true, data: result, message: `${result.queued} message(s) re-queued` });
});

export const balance = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await sms.balance() });
});
