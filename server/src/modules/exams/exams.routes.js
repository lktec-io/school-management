import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import * as c from './exams.controller.js';

const router = Router();

const admin = authorize(ROLES.ADMIN);
const academicStaff = authorize(ROLES.ADMIN, ROLES.TEACHER);

router.post('/marks/bulk', academicStaff, c.saveBulkMarks);

router.get('/', academicStaff, c.listExams);
router.post('/', admin, c.createExam);
router.get('/:id', academicStaff, c.getExam);
router.put('/:id', admin, c.updateExam);
router.delete('/:id', admin, c.deleteExam);
router.get('/:id/marksheet', academicStaff, c.getMarksheet);
router.get('/:id/results', academicStaff, c.getResults);

export default router;
