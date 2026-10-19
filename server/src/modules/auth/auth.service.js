import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { photoVersion, removePhoto, storePhoto } from '../../utils/photoStore.js';
import { signAccessToken } from '../../utils/jwt.js';

// Compared against when the account does not exist so response time does not reveal valid usernames.
const TIMING_GUARD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), env.auth.bcryptSaltRounds);

const INVALID_CREDENTIALS = 'Invalid email/phone or password';

const USER_AUTH_COLUMNS = `id, full_name, email, phone, photo_path, password_hash, role, status, must_change_password,
  token_version, failed_login_attempts, locked_until, last_login_at`;

export function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    mustChangePassword: user.must_change_password === 1,
    lastLoginAt: user.last_login_at,
    // API-relative and versioned per upload, like student photos.
    photoUrl: user.photo_path ? `/auth/users/${user.id}/photo?v=${encodeURIComponent(photoVersion(user.photo_path))}` : null,
  };
}

export async function login({ identifier, password }, context) {
  const column = identifier.type === 'email' ? 'email' : 'phone';
  const user = await queryOne(`SELECT ${USER_AUTH_COLUMNS} FROM users WHERE ${column} = ?`, [identifier.value]);

  if (!user) {
    await bcrypt.compare(password, TIMING_GUARD_HASH);
    await recordAudit({
      ...context,
      action: 'auth.login_failed',
      targetTable: 'users',
      details: { reason: 'unknown_account', identifierType: identifier.type },
    });
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await recordAudit({
      ...context,
      userId: user.id,
      action: 'auth.login_blocked',
      targetTable: 'users',
      targetId: user.id,
      details: { reason: 'account_locked', lockedUntil: user.locked_until },
    });
    throw new ApiError(423, 'This account is temporarily locked after repeated failed sign-ins. Try again later.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const attempts = user.failed_login_attempts + 1;
    const shouldLock = attempts >= env.auth.maxFailedLogins;
    await query(
      `UPDATE users
          SET failed_login_attempts = ?,
              locked_until = IF(?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until)
        WHERE id = ?`,
      [shouldLock ? 0 : attempts, shouldLock, env.auth.lockoutMinutes, user.id],
    );
    await recordAudit({
      ...context,
      userId: user.id,
      action: shouldLock ? 'auth.account_locked' : 'auth.login_failed',
      targetTable: 'users',
      targetId: user.id,
      details: { reason: 'bad_password', attempts },
    });
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  if (user.status !== 'active') {
    await recordAudit({
      ...context,
      userId: user.id,
      action: 'auth.login_blocked',
      targetTable: 'users',
      targetId: user.id,
      details: { reason: `status_${user.status}` },
    });
    throw new ApiError(403, 'Your account is not active. Contact the school administration.', { code: 'ACCOUNT_INACTIVE' });
  }

  await withTransaction(async (connection) => {
    await query(
      `UPDATE users
          SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
        WHERE id = ?`,
      [user.id],
      connection,
    );
    await recordAudit(
      { ...context, userId: user.id, action: 'auth.login', targetTable: 'users', targetId: user.id },
      connection,
    );
  });

  const token = signAccessToken(user);
  return { user: toPublicUser(user), token };
}

export async function getProfile(userId) {
  const user = await queryOne(
    `SELECT id, full_name, email, phone, photo_path, role, status, must_change_password, last_login_at
       FROM users WHERE id = ?`,
    [userId],
  );
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }, context) {
  const user = await queryOne(`SELECT ${USER_AUTH_COLUMNS} FROM users WHERE id = ?`, [userId]);
  if (!user) throw ApiError.notFound('User not found');

  const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentMatches) {
    await recordAudit({
      ...context,
      action: 'auth.password_change_failed',
      targetTable: 'users',
      targetId: user.id,
      details: { reason: 'bad_current_password' },
    });
    throw ApiError.badRequest('Please correct the highlighted fields', {
      currentPassword: 'Current password is incorrect',
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, env.auth.bcryptSaltRounds);

  // Bumping token_version revokes every session issued before the change (other devices included).
  const updatedUser = await withTransaction(async (connection) => {
    await query(
      `UPDATE users
          SET password_hash = ?, must_change_password = 0, password_changed_at = NOW(),
              token_version = token_version + 1, failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?`,
      [passwordHash, user.id],
      connection,
    );
    await recordAudit(
      { ...context, action: 'auth.password_changed', targetTable: 'users', targetId: user.id },
      connection,
    );
    return queryOne(`SELECT ${USER_AUTH_COLUMNS} FROM users WHERE id = ?`, [user.id], connection);
  });

  return { user: toPublicUser(updatedUser), token: signAccessToken(updatedUser) };
}

/** Replace the signed-in user's profile picture (multipart file or data URL), stored in STORAGE_DIR/profiles. */
export async function saveOwnPhoto(userId, upload, context) {
  const before = await queryOne('SELECT photo_path FROM users WHERE id = ?', [userId]);
  if (!before) throw ApiError.notFound('User not found');
  const { relativePath, bytes } = await storePhoto('profiles', userId, upload);
  await query('UPDATE users SET photo_path = ? WHERE id = ?', [relativePath, userId]);
  if (before.photo_path) await removePhoto(before.photo_path);
  await recordAudit({ ...context, action: 'user.photo_upload', targetTable: 'users', targetId: userId, details: { bytes, file: relativePath } });
  return getProfile(userId);
}

export async function deleteOwnPhoto(userId, context) {
  const before = await queryOne('SELECT photo_path FROM users WHERE id = ?', [userId]);
  if (before?.photo_path) {
    await query('UPDATE users SET photo_path = NULL WHERE id = ?', [userId]);
    await removePhoto(before.photo_path);
    await recordAudit({ ...context, action: 'user.photo_delete', targetTable: 'users', targetId: userId });
  }
  return getProfile(userId);
}

/** Stored photo path of a user, visible to that user and to the Headmaster (404 otherwise). */
export async function visibleUserPhotoPath(viewer, userId) {
  if (viewer.id !== userId && viewer.role !== 'admin') throw ApiError.notFound('Photo not found');
  const row = await queryOne('SELECT photo_path FROM users WHERE id = ?', [userId]);
  if (!row?.photo_path) throw ApiError.notFound('Photo not found');
  return row.photo_path;
}
