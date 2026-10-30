import multer from 'multer';
import { SpreadsheetError, readSpreadsheet } from '../utils/spreadsheet.js';
import { ApiError } from './errorHandler.js';

/** Bulk import spreadsheets (CSV/XLSX, ≤ 2 MB) arrive as multipart field "file", kept in memory and parsed in place. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 8 } }).single('file');

export function acceptSpreadsheet(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 2 MB. Split it into smaller files.' : 'Upload one CSV or Excel file in the "file" field';
      return next(ApiError.badRequest(message, { file: message }));
    }
    return next(error);
  });
}

/** Parsed grid of the uploaded file; unreadable files become a 400 with a message staff can act on. */
export function uploadedTable(file) {
  try {
    return readSpreadsheet(file);
  } catch (error) {
    if (error instanceof SpreadsheetError) throw ApiError.badRequest(error.message, { file: error.message });
    throw error;
  }
}
