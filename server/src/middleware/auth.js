import env from '../config/env.js';
import { queryOne } from '../config/db.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError, asyncHandler } from './errorHandler.js';

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  TEACHER: 'teacher',
  PARENT: 'parent',
});

const VALID_ROLES = new Set(Object.values(ROLES));

function extractToken(req) {
  const cookieToken = req.cookies?.[env.cookie.name];
  if (cookieToken) return cookieToken;

  const header = req.get('authorization');
  if (header) {
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) return token.trim();
  }
  return null;
}

/**
 * Verifies the JWT (cookie first, then Bearer header) and re-validates the user against the
 * database on every request so suspended accounts and revoked tokens lose access immediately.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'Your session has expired. Please sign in again.'
      : 'Invalid authentication token';
    throw new ApiError(401, message, { code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' });
  }

  const user = await queryOne(
    `SELECT id, full_name, email, phone, role, status, must_change_password, token_version
       FROM users
      WHERE id = ?`,
    [payload.sub],
  );

  if (!user || user.token_version !== payload.tv) {
    throw new ApiError(401, 'Your session is no longer valid. Please sign in again.', { code: 'SESSION_REVOKED' });
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'Your account is not active. Contact the school administration.', { code: 'ACCOUNT_INACTIVE' });
  }

  req.user = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    mustChangePassword: user.must_change_password === 1,
    tokenVersion: user.token_version,
    remember: payload.rem !== 0,
  };
  next();
});

/** Restrict a route to one or more roles. Must run after authenticate. */
export function authorize(...allowedRoles) {
  const roles = allowedRoles.flat();
  const unknown = roles.filter((role) => !VALID_ROLES.has(role));
  if (roles.length === 0 || unknown.length > 0) {
    throw new Error(`authorize() received invalid roles: ${unknown.join(', ') || '(none)'}`);
  }

  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}

/** Blocks every route except the password-change flow until a temporary password is replaced. */
export function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return next(new ApiError(403, 'You must change your temporary password before continuing.', {
      code: 'PASSWORD_CHANGE_REQUIRED',
    }));
  }
  return next();
}
