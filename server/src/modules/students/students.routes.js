import { Router } from 'express';
import multer from 'multer';
import { ApiError } from '../../middleware/errorHandler.js';
import { authorize, ROLES } from '../../middleware/auth.js';
import * as c from './students.controller.js';

const router = Router();

// Bulk import spreadsheets (CSV/XLSX, ≤ 2 MB) arrive as multipart field "file", kept in memory and parsed in place.
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 5 } }).single('file');
function acceptSpreadsheet(req, res, next) {
  importUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 2 MB. Split the students into smaller files.' : 'Upload one CSV or Excel file in the "file" field';
      return next(ApiError.badRequest(message, { file: message }));
    }
    return next(error);
  });
}

// Row-level scoping (teacher → own classes, parent → own children) is enforced in the service.
router.get('/', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.PARENT), c.listStudents);
router.post('/', authorize(ROLES.ADMIN), c.registerStudent);
router.get('/next-registration-number', authorize(ROLES.ADMIN), c.nextRegistrationNumber);
router.get('/import/template', authorize(ROLES.ADMIN), c.importTemplate);
router.post('/import', authorize(ROLES.ADMIN), acceptSpreadsheet, c.importStudents);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.PARENT), c.getStudent);
router.put('/:id', authorize(ROLES.ADMIN), c.updateStudent);
router.get('/:id/photo', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.PARENT), c.getPhoto);
router.put('/:id/photo', authorize(ROLES.ADMIN), c.uploadPhoto);
router.delete('/:id/photo', authorize(ROLES.ADMIN), c.deletePhoto);

export default router;
