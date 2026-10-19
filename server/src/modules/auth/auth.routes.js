import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { loginLimiter, sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, sensitiveActionLimiter, authController.changePassword);
router.post('/logout', authenticate, authController.logout);
// Every role manages its own profile picture; the Headmaster can view any account's picture.
router.put('/me/photo', authenticate, authController.uploadOwnPhoto);
router.delete('/me/photo', authenticate, authController.deleteOwnPhoto);
router.get('/users/:id/photo', authenticate, authController.userPhoto);

export default router;
