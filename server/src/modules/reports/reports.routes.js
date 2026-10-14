import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import * as c from './reports.controller.js';

const router = Router();

const viewers = authorize(ROLES.ADMIN, ROLES.TEACHER, ROLES.PARENT);
const academicStaff = authorize(ROLES.ADMIN, ROLES.TEACHER);

router.get('/students/:studentId/available', viewers, c.listAvailable);
router.get('/students/:studentId/report-card', viewers, c.getReportCardData);
router.get('/students/:studentId/report-card.pdf', viewers, c.downloadReportCard);
router.get('/classes/:classId/report-cards.pdf', academicStaff, c.downloadClassReportCards);
router.put('/remarks', academicStaff, c.saveRemarks);

export default router;
