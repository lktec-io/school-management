import { ApiError } from '../../middleware/errorHandler.js';
import { normalizeTzPhone } from '../../utils/phone.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// bcrypt only uses the first 72 bytes of input; reject longer passwords instead of silently truncating.
const MAX_PASSWORD_BYTES = 72;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Login accepts an email address or a phone number as `identifier`
 * (`email` is accepted as an alias for clients that send it).
 */
export function validateLogin(body = {}) {
  const errors = {};
  const rawIdentifier = body.identifier ?? body.email;
  const { password } = body;

  let identifier = null;
  if (!isNonEmptyString(rawIdentifier)) {
    errors.identifier = 'Email or phone number is required';
  } else {
    const trimmed = rawIdentifier.trim();
    if (trimmed.includes('@')) {
      if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 190) {
        errors.identifier = 'Enter a valid email address';
      } else {
        identifier = { type: 'email', value: trimmed.toLowerCase() };
      }
    } else {
      const phone = normalizeTzPhone(trimmed);
      if (!phone) errors.identifier = 'Enter a valid email address or Tanzanian phone number';
      else identifier = { type: 'phone', value: phone };
    }
  }

  if (!isNonEmptyString(password)) {
    errors.password = 'Password is required';
  } else if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.password = 'Invalid credentials';
  }

  if (Object.keys(errors).length > 0) throw ApiError.badRequest('Please correct the highlighted fields', errors);
  // Missing flag = remembered (older clients); the login form sends an explicit true/false.
  return { identifier, password, remember: body.remember !== false };
}

export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters long';
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return 'Password must not exceed 72 bytes';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/\d/.test(password)) return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol';
  return null;
}

export function validateChangePassword(body = {}) {
  const errors = {};
  const { currentPassword, newPassword, confirmPassword } = body;

  if (!isNonEmptyString(currentPassword)) errors.currentPassword = 'Current password is required';

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) errors.newPassword = strengthError;
  else if (newPassword === currentPassword) errors.newPassword = 'New password must differ from the current password';

  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    errors.confirmPassword = 'Password confirmation does not match';
  }

  if (Object.keys(errors).length > 0) throw ApiError.badRequest('Please correct the highlighted fields', errors);
  return { currentPassword, newPassword };
}
