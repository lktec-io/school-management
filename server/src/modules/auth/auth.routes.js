import { Router } from 'express';
import multer from 'multer';
import { ApiError } from '../../middleware/errorHandler.js';
import { MAX_PHOTO_BYTES } from '../../utils/photoStore.js';
import { authenticate } from '../../middleware/auth.js';
import { loginLimiter, sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as authController from './auth.controller.js';

const router = Router();

// Profile photos may arrive as multipart/form-data (field "photo"); kept in memory, validated, then written to STORAGE_DIR/profiles.
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 } }).single('photo');
function acceptPhoto(req, res, next) {
  photoUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 1.5 MB' : 'Upload a single image in the "photo" field';
      return next(ApiError.badRequest(message, { photo: message }));
    }
    return next(error);
  });
}

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, sensitiveActionLimiter, authController.changePassword);
router.post('/logout', authenticate, authController.logout);
// Every role manages its own profile picture; the Headmaster can view any account's picture.
router.put('/me/photo', authenticate, acceptPhoto, authController.uploadOwnPhoto);
router.delete('/me/photo', authenticate, authController.deleteOwnPhoto);
router.get('/users/:id/photo', authenticate, authController.userPhoto);

export default router;
