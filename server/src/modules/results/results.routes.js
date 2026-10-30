import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import { acceptSpreadsheet } from '../../middleware/spreadsheetUpload.js';
import * as c from './results.controller.js';

const router = Router();

// Teachers are limited to their assigned subjects row by row in the service.
const academicStaff = authorize(ROLES.ADMIN, ROLES.TEACHER);

router.get('/import/template', academicStaff, c.template);
router.post('/import', academicStaff, acceptSpreadsheet, c.limitSmsUploads, c.importResults);

export default router;
