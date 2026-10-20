import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { parsePagination } from '../../utils/pagination.js';
import { SpreadsheetError, readSpreadsheet } from '../../utils/spreadsheet.js';
import { optionalId, parseId, validator } from '../../utils/validator.js';
import * as importService from './import.service.js';
import * as photoService from './photo.service.js';
import * as studentsService from './students.service.js';
import { validateStudent } from './students.validation.js';

export const listStudents = asyncHandler(async (req, res) => {
  const { status, gender, search, sort, dir } = req.query;
  if (status && !studentsService.STUDENT_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter');
  if (gender && !['male', 'female'].includes(gender)) throw ApiError.badRequest('Invalid gender filter');
  const filters = {
    classId: optionalId(req.query.classId, 'classId'),
    streamId: optionalId(req.query.streamId, 'streamId'),
    status,
    gender,
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

export const nextRegistrationNumber = asyncHandler(async (req, res) => {
  const { admissionDate } = validator(req.query).date('admissionDate', { notBefore: '1990-01-01', notAfter: todayInSchoolTz() }).result();
  res.json({ success: true, data: await studentsService.previewRegistrationNumber(admissionDate) });
});

export const importTemplate = asyncHandler(async (req, res) => {
  const { filename, content } = await importService.importTemplate();
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.send(content);
});

/**
 * POST /students/import — either multipart/form-data with the spreadsheet in field "file" (CSV or .xlsx)
 * and commit=true to save, or JSON { table: string[][] (first row = headers), commit?: boolean }.
 * Without commit nothing is saved: the response previews every row. With commit the valid rows are
 * registered and the response reports { total, imported, created[], failed[{ line, reasons, message }] }.
 */
export const importStudents = asyncHandler(async (req, res) => {
  let table;
  if (req.file) {
    try {
      table = readSpreadsheet(req.file);
    } catch (error) {
      if (error instanceof SpreadsheetError) throw ApiError.badRequest(error.message, { file: error.message });
      throw error;
    }
  } else {
    table = req.body?.table;
  }
  if (!Array.isArray(table)) throw ApiError.badRequest('Upload a CSV or Excel (.xlsx) file in the "file" field', { file: 'No file received' });
  const cells = table.map((row) => (Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))) : row));
  const commit = req.body?.commit === true || req.body?.commit === 'true';
  if (commit) {
    const result = await importService.commitImport(cells, auditContext(req));
    const message = result.failed.length
      ? `${result.imported} of ${result.total} student(s) imported; ${result.failed.length} row(s) failed`
      : `All ${result.imported} student(s) imported`;
    res.status(201).json({ success: true, data: result, message });
    return;
  }
  res.json({ success: true, data: await importService.previewImport(cells) });
});

export const getStudent = asyncHandler(async (req, res) => {
  const profile = await studentsService.getStudentProfile(parseId(req.params.id), req.user);
  res.json({ success: true, data: profile });
});

export const uploadPhoto = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { dataUrl } = validator(req.body).string('dataUrl', { required: true, max: 3 * 1024 * 1024 }).result();
  await photoService.savePhoto(id, dataUrl, auditContext(req));
  const student = await studentsService.getStudentRecord(id);
  res.json({ success: true, data: student, message: 'Photo updated' });
});

export const deletePhoto = asyncHandler(async (req, res) => {
  await photoService.deletePhoto(parseId(req.params.id), auditContext(req));
  res.json({ success: true, message: 'Photo removed' });
});

export const getPhoto = asyncHandler(async (req, res) => {
  const photoPath = await studentsService.visiblePhotoPath(parseId(req.params.id), req.user);
  const photo = photoPath ? await photoService.readPhoto(photoPath) : null;
  if (!photo) throw ApiError.notFound('No photo uploaded');
  res.set({
    'Content-Type': photo.mime,
    'Content-Length': photo.buffer.length,
    // URLs are versioned per upload, so the browser may keep them; private because they need a session.
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(photo.buffer);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentsService.updateStudent(
    parseId(req.params.id),
    validateStudent(req.body, { partial: true }),
    auditContext(req),
  );
  res.json({ success: true, data: student });
});
