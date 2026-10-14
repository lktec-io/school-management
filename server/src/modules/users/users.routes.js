import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import { sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as c from './users.controller.js';

const router = Router();

router.use(authorize(ROLES.ADMIN));

router.get('/', c.listUsers);
router.post('/', c.createUser);
router.put('/:id', c.updateUser);
router.post('/:id/reset-password', sensitiveActionLimiter, c.resetPassword);

export default router;
