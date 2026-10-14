import env from '../../config/env.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext, recordAudit } from '../../utils/audit.js';
import { clearSessionCookie, setSessionCookie } from '../../utils/jwt.js';
import * as authService from './auth.service.js';
import { validateChangePassword, validateLogin } from './auth.validation.js';

function sessionResponse(user, token) {
  const data = { user, expiresInSeconds: env.auth.jwtExpiresInMinutes * 60 };
  if (env.auth.exposeToken) data.token = token;
  return { success: true, data };
}

export const login = asyncHandler(async (req, res) => {
  const credentials = validateLogin(req.body);
  const { user, token } = await authService.login(credentials, auditContext(req));
  setSessionCookie(res, token);
  res.status(200).json(sessionResponse(user, token));
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.status(200).json({ success: true, data: { user } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const payload = validateChangePassword(req.body);
  const { user, token } = await authService.changePassword(req.user.id, payload, auditContext(req));
  setSessionCookie(res, token);
  res.status(200).json({ ...sessionResponse(user, token), message: 'Password changed successfully' });
});

export const logout = asyncHandler(async (req, res) => {
  await recordAudit({ ...auditContext(req), action: 'auth.logout', targetTable: 'users', targetId: req.user.id });
  clearSessionCookie(res);
  res.status(200).json({ success: true, message: 'Signed out successfully' });
});
