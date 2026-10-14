import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import { sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as c from './sms.controller.js';

const router = Router();

router.use(authorize(ROLES.ADMIN, ROLES.ACCOUNTANT));

router.get('/balance', c.balance);
router.get('/logs', c.logs);
router.post('/preview', c.preview);
// Broadcasts cost money: throttle per user on top of the global limiter.
router.post('/send-bulk', sensitiveActionLimiter, c.sendBulk);
router.post('/retry', sensitiveActionLimiter, c.retry);

export default router;
