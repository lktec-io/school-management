import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import * as c from './students.controller.js';

const router = Router();

// Row-level scoping (teacher → own classes, parent → own children) is enforced in the service.
router.get('/', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.PARENT), c.listStudents);
router.post('/', authorize(ROLES.ADMIN), c.registerStudent);
router.get('/next-registration-number', authorize(ROLES.ADMIN), c.nextRegistrationNumber);
router.get('/import/template', authorize(ROLES.ADMIN), c.importTemplate);
router.post('/import', authorize(ROLES.ADMIN), c.importStudents);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.PARENT), c.getStudent);
router.put('/:id', authorize(ROLES.ADMIN), c.updateStudent);
router.get('/:id/photo', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.PARENT), c.getPhoto);
router.put('/:id/photo', authorize(ROLES.ADMIN), c.uploadPhoto);
router.delete('/:id/photo', authorize(ROLES.ADMIN), c.deletePhoto);

export default router;
