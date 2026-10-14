import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { loginLimiter, sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, sensitiveActionLimiter, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

export default router;
