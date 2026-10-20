import { Router } from 'express';
import { pingDatabase } from '../config/db.js';
import { authenticate, requirePasswordChanged } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import academicsRoutes from '../modules/academics/academics.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import examsRoutes from '../modules/exams/exams.routes.js';
import financeRoutes from '../modules/finance/finance.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';
import smsRoutes from '../modules/sms/sms.routes.js';
import studentsRoutes from '../modules/students/students.routes.js';
import { assetStatus } from '../modules/system/branding.service.js';
import { getSchoolProfile, parseReelCodes, prefixFromRegistrationNo } from '../modules/system/settings.service.js';
import { publicAnnouncements, serveAsset } from '../modules/system/system.controller.js';
import systemRoutes from '../modules/system/system.routes.js';
import usersRoutes from '../modules/users/users.routes.js';

const router = Router();

router.get('/health', asyncHandler(async (req, res) => {
  await pingDatabase();
  res.status(200).json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
}));

// Public school identity and logo for the login page and portal branding.
router.get('/school', asyncHandler(async (req, res) => {
  const [profile, branding] = await Promise.all([getSchoolProfile(), assetStatus()]);
  const { name, motto, address, phone, email, website, instagramUrl, registrationNo, headmasterName, vision, mission } = profile;
  res.json({
    success: true,
    data: {
      name, motto, address, phone, email, website, instagramUrl, registrationNo, headmasterName, vision, mission,
      hasLogo: branding.assets.logo.uploaded || Boolean(branding.assets.logo.fromEnv),
      logoVersion: branding.version,
      // Prefix of new registration numbers (S1819/2026/001), shown as a preview when registering students.
      regNumberPrefix: prefixFromRegistrationNo(registrationNo),
      instagramReels: parseReelCodes(profile.instagramReels).codes,
    },
  });
}));
router.get('/school/logo', serveAsset);
router.get('/announcements', publicAnnouncements);

router.use('/auth', authRoutes);

// Everything below requires a signed-in user who has replaced any temporary password.
const protectedRoute = [authenticate, requirePasswordChanged];
router.use('/dashboard', protectedRoute, dashboardRoutes);
router.use('/academics', protectedRoute, academicsRoutes);
router.use('/students', protectedRoute, studentsRoutes);
router.use('/exams', protectedRoute, examsRoutes);
router.use('/reports', protectedRoute, reportsRoutes);
router.use('/users', protectedRoute, usersRoutes);
router.use('/finance', protectedRoute, financeRoutes);
router.use('/sms', protectedRoute, smsRoutes);
router.use('/audit-logs', protectedRoute, auditRoutes);
router.use('/system', protectedRoute, systemRoutes);

export default router;
