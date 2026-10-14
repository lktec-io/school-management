import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import { sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as c from './system.controller.js';

const router = Router();
const headmaster = authorize(ROLES.ADMIN);

router.get('/settings', headmaster, c.getSettingsHandler);
router.put('/settings', headmaster, c.updateSettingsHandler);

router.get('/branding/:kind', c.serveAsset);
router.put('/branding/:kind', headmaster, c.uploadAsset);
router.delete('/branding/:kind', headmaster, c.deleteAsset);

router.get('/announcements', headmaster, c.listAnnouncements);
router.post('/announcements', headmaster, c.createAnnouncement);
router.put('/announcements/:id', headmaster, c.updateAnnouncement);
router.delete('/announcements/:id', headmaster, c.deleteAnnouncement);

router.get('/info', headmaster, c.systemInfo);
router.post('/backup', headmaster, sensitiveActionLimiter, c.downloadBackup);
router.get('/backups', headmaster, c.listBackups);
router.get('/backups/:file', headmaster, sensitiveActionLimiter, c.downloadStoredBackup);

export default router;
