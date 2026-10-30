import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import { uploadedTable } from '../../middleware/spreadsheetUpload.js';
import { auditContext } from '../../utils/audit.js';
import { optionalId } from '../../utils/validator.js';
import * as resultsService from './results.service.js';

const flag = (value) => value === true || value === 'true';

export const template = asyncHandler(async (req, res) => {
  const { filename, content } = await resultsService.resultsTemplate({
    examId: optionalId(req.query.examId, 'examId'),
    classId: optionalId(req.query.classId, 'classId'),
    streamId: optionalId(req.query.streamId, 'streamId'),
  }, req.user);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.send(content);
});

/** Sending SMS spends credit, so uploads that text parents share the throttle of other sensitive actions. */
export function limitSmsUploads(req, res, next) {
  return flag(req.body?.sendSms) && !flag(req.body?.dryRun) ? sensitiveActionLimiter(req, res, next) : next();
}

/**
 * POST /results/import — multipart/form-data: "file" (CSV or .xlsx), optional examId (used for rows with Term and
 * ExamType blank), sendSms=true to text parents, dryRun=true to check the file without saving. Every row of the
 * file is accounted for in the response: rows (valid), failed (line + reasons) or skipped (no marks entered).
 */
export const importResults = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Upload a CSV or Excel (.xlsx) file in the "file" field', { file: 'No file received' });
  const options = { defaultExamId: optionalId(req.body.examId, 'examId') };
  const sendSms = flag(req.body.sendSms);
  if (sendSms && req.user.role !== 'admin') throw ApiError.forbidden('Only the Headmaster can send examination results');

  const table = uploadedTable(req.file);
  if (flag(req.body.dryRun)) {
    res.json({ success: true, data: await resultsService.previewResults(table, req.user, options) });
    return;
  }
  const result = await resultsService.importResults(table, req.user, auditContext(req), {
    ...options,
    sendSms,
    fileName: String(req.file.originalname ?? '').slice(0, 150),
  });
  res.status(result.saved > 0 ? 201 : 200).json({
    success: true,
    data: result,
    message: `${result.saved} of ${result.total} student result record(s) saved; ${result.failedCount} row(s) failed`,
  });
});
