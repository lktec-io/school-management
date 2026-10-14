import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import * as c from './academics.controller.js';

const router = Router();

const admin = authorize(ROLES.ADMIN);
const staff = authorize(ROLES.ADMIN, ROLES.TEACHER, ROLES.ACCOUNTANT);
const academicStaff = authorize(ROLES.ADMIN, ROLES.TEACHER);

// Current period is needed by every signed-in role (top bar badge).
router.get('/current', c.getCurrent);

router.get('/years', staff, c.listYears);
router.post('/years', admin, c.createYear);
router.put('/years/:id', admin, c.updateYear);
router.delete('/years/:id', admin, c.deleteYear);
router.post('/years/:id/set-current', admin, c.setCurrentYear);

router.post('/terms', admin, c.createTerm);
router.put('/terms/:id', admin, c.updateTerm);
router.delete('/terms/:id', admin, c.deleteTerm);
router.post('/terms/:id/set-current', admin, c.setCurrentTerm);

router.get('/classes', staff, c.listClasses);
router.post('/classes', admin, c.createClass);
router.put('/classes/:id', admin, c.updateClass);
router.delete('/classes/:id', admin, c.deleteClass);

router.post('/streams', admin, c.createStream);
router.put('/streams/:id', admin, c.updateStream);
router.delete('/streams/:id', admin, c.deleteStream);

router.get('/subjects', staff, c.listSubjects);
router.post('/subjects', admin, c.createSubject);
router.put('/subjects/:id', admin, c.updateSubject);
router.delete('/subjects/:id', admin, c.deleteSubject);

router.get('/assignments', academicStaff, c.listAssignments);
router.post('/assignments', admin, c.createAssignment);
router.put('/assignments/:id', admin, c.updateAssignment);
router.delete('/assignments/:id', admin, c.deleteAssignment);

export default router;
