import { ApiError } from '../middleware/errorHandler.js';
import { normalizeTzPhone } from './phone.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Fluent request-body validator.
 *
 *   const data = validator(req.body, { partial: true })
 *     .string('firstName', { required: true, max: 60 })
 *     .id('classId', { required: true })
 *     .result();
 *
 * - Absent fields are skipped (and reported as missing when required, unless `partial`).
 * - Empty strings / null on optional fields become null so they can clear a column.
 * - `result()` throws a 400 with per-field messages, or returns only the fields provided.
 */
export function validator(source, { partial = false } = {}) {
  const input = source && typeof source === 'object' ? source : {};
  const data = {};
  const errors = {};

  const fail = (field, message) => {
    if (!errors[field]) errors[field] = message;
  };

  function resolve(field, required) {
    const raw = input[field];
    if (raw === undefined) {
      if (required && !partial) fail(field, 'This field is required');
      return { skip: true };
    }
    if (isBlank(raw)) {
      if (required) fail(field, 'This field is required');
      else data[field] = null;
      return { skip: true };
    }
    return { skip: false, raw };
  }

  const api = {
    string(field, { required = false, min = 0, max = 255, pattern, patternMessage, multiline = false, transform } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        fail(field, 'Must be text');
        return api;
      }
      let value = String(raw).trim();
      if (!multiline) value = value.replace(/\s+/g, ' ');
      if (value.length < min) return fail(field, `Must be at least ${min} characters`), api;
      if (value.length > max) return fail(field, `Must not exceed ${max} characters`), api;
      if (pattern && !pattern.test(value)) return fail(field, patternMessage || 'Invalid format'), api;
      data[field] = transform ? transform(value) : value;
      return api;
    },

    integer(field, { required = false, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isInteger(value)) return fail(field, 'Must be a whole number'), api;
      if (value < min || value > max) return fail(field, `Must be between ${min} and ${max}`), api;
      data[field] = value;
      return api;
    },

    id(field, { required = false } = {}) {
      return api.integer(field, { required, min: 1, max: 4294967295 });
    },

    number(field, { required = false, min = -Infinity, max = Infinity, decimals = 2 } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) return fail(field, 'Must be a number'), api;
      if (value < min || value > max) return fail(field, `Must be between ${min} and ${max}`), api;
      const factor = 10 ** decimals;
      if (Math.round(value * factor) / factor !== value) {
        return fail(field, `Must have at most ${decimals} decimal places`), api;
      }
      data[field] = value;
      return api;
    },

    boolean(field, { required = false } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      if (raw === true || raw === 1 || raw === '1' || raw === 'true') data[field] = true;
      else if (raw === false || raw === 0 || raw === '0' || raw === 'false') data[field] = false;
      else fail(field, 'Must be true or false');
      return api;
    },

    oneOf(field, allowed, { required = false } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      if (!allowed.includes(raw)) return fail(field, `Must be one of: ${allowed.join(', ')}`), api;
      data[field] = raw;
      return api;
    },

    date(field, { required = false, notAfter, notBefore } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      const value = String(raw).trim().slice(0, 10);
      if (!isValidIsoDate(value)) return fail(field, 'Must be a valid date (YYYY-MM-DD)'), api;
      if (notAfter && value > notAfter) return fail(field, `Must not be after ${notAfter}`), api;
      if (notBefore && value < notBefore) return fail(field, `Must not be before ${notBefore}`), api;
      data[field] = value;
      return api;
    },

    email(field, { required = false } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      const value = String(raw).trim().toLowerCase();
      if (value.length > 190 || !EMAIL_PATTERN.test(value)) return fail(field, 'Must be a valid email address'), api;
      data[field] = value;
      return api;
    },

    phone(field, { required = false } = {}) {
      const { skip, raw } = resolve(field, required);
      if (skip) return api;
      const value = normalizeTzPhone(raw);
      if (!value) return fail(field, 'Must be a valid Tanzanian mobile number (e.g. 0777 123 456)'), api;
      data[field] = value;
      return api;
    },

    /** Add a cross-field rule: `check(data)` returns an error message or null. */
    rule(field, check) {
      if (errors[field]) return api;
      const message = check(data, input);
      if (message) fail(field, message);
      return api;
    },

    result() {
      if (Object.keys(errors).length > 0) {
        throw ApiError.badRequest('Please correct the highlighted fields', errors);
      }
      if (partial && Object.keys(data).length === 0) {
        throw ApiError.badRequest('No changes were submitted');
      }
      return data;
    },
  };

  return api;
}

/** Parse a positive integer route/query parameter; throws 400 when invalid. */
export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
    throw ApiError.badRequest(`Invalid ${label}`, { [label]: 'Must be a positive whole number' });
  }
  return id;
}

/** Parse an optional positive integer query parameter; returns null when absent. */
export function optionalId(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return parseId(value, label);
}
