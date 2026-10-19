import { queryOne } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { parsePagination } from '../../utils/pagination.js';
import { pdfFileName } from '../../utils/pdfBranding.js';
import { streamPdf } from '../../utils/pdfResponse.js';
import { isValidIsoDate, optionalId, parseId, validator } from '../../utils/validator.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { loadBranding } from '../system/branding.service.js';
import { getSchoolProfile } from '../system/settings.service.js';
import { studentTermBalance } from './balances.service.js';
import * as expenses from './expenses.service.js';
import * as feeSetup from './feeSetup.service.js';
import * as reports from './financeReports.service.js';
import * as payments from './payments.service.js';
import { createReceiptDocument, renderReceipt } from './receipt.pdf.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const MAX_AMOUNT = 1_000_000_000;
const CODE_PATTERN = /^[A-Za-z0-9-]+$/;

function optionalDate(value, label) {
  if (value === undefined || value === '') return null;
  if (!isValidIsoDate(value)) throw ApiError.badRequest(`Invalid ${label}`, { [label]: 'Use YYYY-MM-DD' });
  return value;
}

function optionalEnum(value, allowed, label) {
  if (value === undefined || value === '') return null;
  if (!allowed.includes(value)) throw ApiError.badRequest(`Invalid ${label} filter`);
  return value;
}

const searchParam = (value) => (typeof value === 'string' ? value.trim().slice(0, 100) : '');

async function defaultTermId(value) {
  const termId = optionalId(value, 'termId');
  if (termId) return termId;
  const { term } = await getCurrentPeriod();
  if (!term) throw ApiError.badRequest('No current term is set. Choose a term.', { termId: 'Term is required' });
  return term.id;
}

async function assertStudentAccess(studentId, user) {
  const student = await queryOne('SELECT id, parent_user_id AS parentUserId FROM students WHERE id = ?', [studentId]);
  if (!student || (user.role === 'parent' && student.parentUserId !== user.id)) throw ApiError.notFound('Student not found');
}

// Overview & reports -------------------------------------------------------

export const overview = asyncHandler(async (req, res) => ok(res, await reports.getOverview()));

export const summary = asyncHandler(async (req, res) => {
  ok(res, await reports.getSummary({
    dateFrom: optionalDate(req.query.dateFrom, 'dateFrom'),
    dateTo: optionalDate(req.query.dateTo, 'dateTo'),
  }));
});

export const defaulters = asyncHandler(async (req, res) => {
  const minBalance = req.query.minBalance ? Number(req.query.minBalance) : 0;
  if (!Number.isFinite(minBalance) || minBalance < 0) throw ApiError.badRequest('Invalid minimum balance');
  ok(res, await reports.getDefaulters({
    termId: optionalId(req.query.termId, 'termId'),
    classId: optionalId(req.query.classId, 'classId'),
    streamId: optionalId(req.query.streamId, 'streamId'),
    minBalance,
    search: searchParam(req.query.search),
  }, parsePagination(req.query, { defaultPageSize: 50, maxPageSize: 500 })));
});

export const studentStatement = asyncHandler(async (req, res) => {
  const studentId = parseId(req.params.id, 'studentId');
  await assertStudentAccess(studentId, req.user);
  const termId = await defaultTermId(req.query.termId);
  const [balance, history] = await Promise.all([
    studentTermBalance(studentId, termId),
    payments.listPayments({ studentId, termId }, { page: 1, pageSize: 100, offset: 0 }),
  ]);
  ok(res, { termId, balance, payments: history.items });
});

// Fee types ------------------------------------------------------------------

function validateFeeType(body, { partial = false } = {}) {
  return validator(body, { partial })
    .string('name', { required: true, max: 80 })
    .string('code', { required: true, max: 20, pattern: CODE_PATTERN, patternMessage: 'Letters, numbers and hyphens only', transform: (v) => v.toUpperCase() })
    .string('description', { max: 255 })
    .integer('displayOrder', { min: 0, max: 999 })
    .boolean('isActive')
    .result();
}

export const listFeeTypes = asyncHandler(async (req, res) => {
  ok(res, await feeSetup.listFeeTypes({ includeInactive: req.query.includeInactive === 'true' }));
});
export const createFeeType = asyncHandler(async (req, res) => {
  ok(res, await feeSetup.createFeeType(validateFeeType(req.body), auditContext(req)), 201);
});
export const updateFeeType = asyncHandler(async (req, res) => {
  ok(res, await feeSetup.updateFeeType(parseId(req.params.id), validateFeeType(req.body, { partial: true }), auditContext(req)));
});
export const deleteFeeType = asyncHandler(async (req, res) => {
  await feeSetup.deleteFeeType(parseId(req.params.id), auditContext(req));
  res.json({ success: true, message: 'Fee type deleted' });
});

// Fee structures ---------------------------------------------------------------

export const listStructures = asyncHandler(async (req, res) => {
  const termId = await defaultTermId(req.query.termId);
  ok(res, { termId, items: await feeSetup.listStructures({ termId, classId: optionalId(req.query.classId, 'classId') }) });
});

export const createStructures = asyncHandler(async (req, res) => {
  const data = validator(req.body)
    .id('feeTypeId', { required: true })
    .id('termId', { required: true })
    .number('amount', { required: true, min: 0, max: MAX_AMOUNT })
    .boolean('isMandatory')
    .result();
  const classIds = Array.isArray(req.body.classIds) ? [...new Set(req.body.classIds.map(Number))] : [];
  if (classIds.length === 0 || classIds.some((id) => !Number.isInteger(id) || id < 1)) {
    throw ApiError.badRequest('Please correct the highlighted fields', { classIds: 'Select at least one class' });
  }
  ok(res, await feeSetup.createStructures({ ...data, classIds }, req.user, auditContext(req)), 201);
});

export const updateStructure = asyncHandler(async (req, res) => {
  const data = validator(req.body, { partial: true })
    .number('amount', { required: true, min: 0, max: MAX_AMOUNT })
    .boolean('isMandatory')
    .result();
  ok(res, await feeSetup.updateStructure(parseId(req.params.id), data, auditContext(req)));
});

export const deleteStructure = asyncHandler(async (req, res) => {
  await feeSetup.deleteStructure(parseId(req.params.id), auditContext(req));
  res.json({ success: true, message: 'Fee structure deleted' });
});

export const copyStructures = asyncHandler(async (req, res) => {
  const data = validator(req.body).id('fromTermId', { required: true }).id('toTermId', { required: true }).result();
  ok(res, await feeSetup.copyStructures(data, req.user, auditContext(req)));
});

export const listAllocations = asyncHandler(async (req, res) => {
  ok(res, await feeSetup.listAllocations(parseId(req.params.id)));
});

export const setAllocations = asyncHandler(async (req, res) => {
  const studentIds = Array.isArray(req.body.studentIds) ? [...new Set(req.body.studentIds.map(Number))] : null;
  if (!studentIds || studentIds.some((id) => !Number.isInteger(id) || id < 1)) {
    throw ApiError.badRequest('Please correct the highlighted fields', { studentIds: 'Provide a list of student IDs' });
  }
  ok(res, await feeSetup.setAllocations(parseId(req.params.id), studentIds, req.user, auditContext(req)));
});

// Discounts ----------------------------------------------------------------------

export const listDiscounts = asyncHandler(async (req, res) => {
  ok(res, await feeSetup.listDiscounts({
    termId: optionalId(req.query.termId, 'termId'),
    studentId: optionalId(req.query.studentId, 'studentId'),
    status: optionalEnum(req.query.status, ['active', 'revoked'], 'status'),
  }));
});

export const createDiscount = asyncHandler(async (req, res) => {
  const data = validator(req.body)
    .id('studentId', { required: true })
    .id('termId', { required: true })
    .id('feeTypeId')
    .oneOf('discountType', ['fixed', 'percentage'], { required: true })
    .number('value', { required: true, min: 0.01, max: MAX_AMOUNT })
    .string('reason', { required: true, min: 5, max: 255 })
    .rule('value', (values) => (values.discountType === 'percentage' && values.value > 100 ? 'A percentage cannot exceed 100' : null))
    .result();
  ok(res, await feeSetup.createDiscount(data, req.user, auditContext(req)), 201);
});

export const revokeDiscount = asyncHandler(async (req, res) => {
  const { reason } = validator(req.body).string('reason', { required: true, min: 5, max: 255 }).result();
  ok(res, await feeSetup.revokeDiscount(parseId(req.params.id), reason, req.user, auditContext(req)));
});

// Payments ---------------------------------------------------------------------

export const listPayments = asyncHandler(async (req, res) => {
  ok(res, await payments.listPayments({
    termId: optionalId(req.query.termId, 'termId'),
    classId: optionalId(req.query.classId, 'classId'),
    studentId: optionalId(req.query.studentId, 'studentId'),
    paymentMode: optionalEnum(req.query.paymentMode, payments.PAYMENT_MODES, 'paymentMode'),
    status: optionalEnum(req.query.status, ['confirmed', 'reversed'], 'status'),
    dateFrom: optionalDate(req.query.dateFrom, 'dateFrom'),
    dateTo: optionalDate(req.query.dateTo, 'dateTo'),
    search: searchParam(req.query.search),
  }, parsePagination(req.query)));
});

export const nextReceipt = asyncHandler(async (req, res) => {
  const { paymentDate } = validator(req.query).date('paymentDate', { notAfter: todayInSchoolTz(), notBefore: '2000-01-01' }).result();
  res.json({ success: true, data: await payments.previewReceiptNo(paymentDate) });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const data = validator(req.body)
    .id('studentId', { required: true })
    .id('termId')
    .id('feeTypeId')
    .number('amountPaid', { required: true, min: 1, max: MAX_AMOUNT })
    .oneOf('paymentMode', payments.PAYMENT_MODES, { required: true })
    .string('referenceNo', { max: 100, transform: (v) => v.toUpperCase() })
    .date('paymentDate', { notAfter: todayInSchoolTz(), notBefore: '2000-01-01' })
    .string('notes', { max: 255, multiline: true })
    .boolean('sendSms')
    .result();
  const result = await payments.recordPayment(data, req.user, auditContext(req));
  res.status(201).json({ success: true, data: result, message: `Payment recorded — receipt ${result.payment.receiptNo}` });
});

export const getPayment = asyncHandler(async (req, res) => {
  ok(res, await payments.findPayment(parseId(req.params.id), req.user));
});

export const reversePayment = asyncHandler(async (req, res) => {
  const { reason } = validator(req.body).string('reason', { required: true, min: 5, max: 255, multiline: true }).result();
  ok(res, await payments.reversePayment(parseId(req.params.id), reason, req.user, auditContext(req)));
});

export const receiptPdf = asyncHandler(async (req, res) => {
  const [data, school, branding] = await Promise.all([
    payments.getReceiptData(parseId(req.params.id), req.user),
    getSchoolProfile(),
    loadBranding(),
  ]);
  const fileName = pdfFileName('receipt', data.payment.receiptNo);
  streamPdf(req, res, createReceiptDocument(`Receipt ${data.payment.receiptNo}`, school.name), fileName,
    (doc) => renderReceipt(doc, { ...data, school, branding }));
});

// Expenses ---------------------------------------------------------------------

export const listExpenses = asyncHandler(async (req, res) => {
  ok(res, await expenses.listExpenses({
    category: optionalEnum(req.query.category, expenses.EXPENSE_CATEGORIES, 'category'),
    status: optionalEnum(req.query.status, ['recorded', 'voided'], 'status'),
    dateFrom: optionalDate(req.query.dateFrom, 'dateFrom'),
    dateTo: optionalDate(req.query.dateTo, 'dateTo'),
    search: searchParam(req.query.search),
  }, parsePagination(req.query)));
});

export const createExpense = asyncHandler(async (req, res) => {
  const data = validator(req.body)
    .oneOf('category', expenses.EXPENSE_CATEGORIES, { required: true })
    .string('description', { required: true, min: 3, max: 255 })
    .string('payee', { max: 150 })
    .number('amount', { required: true, min: 1, max: MAX_AMOUNT })
    .date('expenseDate', { notAfter: todayInSchoolTz(), notBefore: '2000-01-01' })
    .oneOf('paymentMode', payments.PAYMENT_MODES, { required: true })
    .string('referenceNo', { max: 100 })
    .result();
  ok(res, await expenses.createExpense(data, req.user, auditContext(req)), 201);
});

export const voidExpense = asyncHandler(async (req, res) => {
  const { reason } = validator(req.body).string('reason', { required: true, min: 5, max: 255, multiline: true }).result();
  ok(res, await expenses.voidExpense(parseId(req.params.id), reason, req.user, auditContext(req)));
});
