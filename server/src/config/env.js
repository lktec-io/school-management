import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const errors = [];

/*
 * SMS credentials: server/.env is authoritative. dotenv never overrides variables that already
 * exist, and PM2 keeps the environment a process was first started with (and copies the shell's
 * environment on `pm2 reload --update-env`), so a stale BEEM_* value there would silently win over
 * a corrected .env and Beem would answer "Invalid Authentication Parameters".
 */
const BEEM_FILE_KEYS = ['BEEM_API_KEY', 'BEEM_SECRET_KEY', 'BEEM_SENDER_ID'];
const beemOverriddenFromFile = [];
try {
  const fileEnv = dotenv.parse(fs.readFileSync(path.join(serverRoot, '.env')));
  for (const key of BEEM_FILE_KEYS) {
    const fromFile = fileEnv[key];
    if (fromFile === undefined || fromFile.trim() === '') continue;
    if (process.env[key] !== undefined && process.env[key] !== fromFile) beemOverriddenFromFile.push(key);
    process.env[key] = fromFile;
  }
} catch (error) {
  if (error.code !== 'ENOENT') errors.push(`server/.env could not be read: ${error.message}`);
}

/**
 * API keys never contain spaces: drop surrounding quotes, whitespace anywhere, and invisible
 * characters (BOM, zero-width, non-breaking space) that sneak in when keys are copied from a browser.
 */
function readCredential(name) {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const cleaned = raw
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, '')
    .trim()
    .replace(/^(['"`])(.*)\1$/s, '$2')
    .replace(/\s+/g, '');
  return cleaned === '' ? undefined : cleaned;
}

function read(name, { required = false, fallback } = {}) {
  const raw = process.env[name];
  const value = raw === undefined || raw.trim() === '' ? undefined : raw.trim();
  if (value === undefined) {
    if (required) errors.push(`${name} is required`);
    return fallback;
  }
  return value;
}

function readInt(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

function readBool(name, fallback) {
  const raw = read(name);
  if (raw === undefined) return fallback;
  if (['true', '1', 'yes'].includes(raw.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(raw.toLowerCase())) return false;
  errors.push(`${name} must be true or false`);
  return fallback;
}

const nodeEnv = read('NODE_ENV', { fallback: 'development' });
const isProduction = nodeEnv === 'production';

const jwtSecret = read('JWT_SECRET', { required: true });
if (jwtSecret && jwtSecret.length < 32) {
  errors.push('JWT_SECRET must be at least 32 characters long');
}

const sameSite = read('COOKIE_SAMESITE', { fallback: 'strict' }).toLowerCase();
if (!['strict', 'lax', 'none'].includes(sameSite)) {
  errors.push('COOKIE_SAMESITE must be one of strict, lax, none');
}
const cookieSecure = readBool('COOKIE_SECURE', isProduction);
if (sameSite === 'none' && !cookieSecure) {
  errors.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
}

// Public hostname (e.g. school.clixworks.co.tz). When CORS_ORIGINS is not set, the portal's
// own https origin is allowed; without a domain, local development defaults to Vite's port.
const domain = read('DOMAIN');
if (domain && !/^[A-Za-z0-9.-]+$/.test(domain)) errors.push('DOMAIN must be a bare hostname such as school.clixworks.co.tz');
const corsOrigins = (read('CORS_ORIGINS', {
  required: isProduction && !domain,
  fallback: domain ? `https://${domain}` : 'http://localhost:5173',
}) || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: readInt('PORT', 5000, { min: 1, max: 65535 }),
  domain: domain ?? null,
  trustProxy: readInt('TRUST_PROXY', 0, { min: 0, max: 10 }),
  corsOrigins,

  db: Object.freeze({
    host: read('DB_HOST', { required: true }),
    port: readInt('DB_PORT', 3306, { min: 1, max: 65535 }),
    user: read('DB_USER', { required: true }),
    password: read('DB_PASSWORD', { fallback: '' }),
    name: read('DB_NAME', { required: true }),
    connectionLimit: readInt('DB_CONNECTION_LIMIT', 10, { min: 1, max: 200 }),
    timezone: read('DB_TIMEZONE', { fallback: '+03:00' }),
  }),

  auth: Object.freeze({
    jwtSecret,
    jwtExpiresInMinutes: readInt('JWT_EXPIRES_IN_MINUTES', 480, { min: 5, max: 10080 }),
    jwtIssuer: read('JWT_ISSUER', { fallback: 'school-management-api' }),
    jwtAudience: read('JWT_AUDIENCE', { fallback: 'school-management-portal' }),
    bcryptSaltRounds: readInt('BCRYPT_SALT_ROUNDS', 12, { min: 10, max: 15 }),
    maxFailedLogins: readInt('MAX_FAILED_LOGINS', 5, { min: 1, max: 50 }),
    lockoutMinutes: readInt('LOCKOUT_MINUTES', 15, { min: 1, max: 1440 }),
    exposeToken: readBool('AUTH_EXPOSE_TOKEN', false),
  }),

  cookie: Object.freeze({
    name: read('COOKIE_NAME', { fallback: 'sms_session' }),
    secure: cookieSecure,
    sameSite,
    domain: read('COOKIE_DOMAIN'),
  }),

  rateLimit: Object.freeze({
    windowMs: readInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    max: readInt('RATE_LIMIT_MAX', 2000, { min: 1 }),
    loginMax: readInt('LOGIN_RATE_LIMIT_MAX', 10, { min: 1 }),
  }),

  school: Object.freeze({
    name: read('SCHOOL_NAME', { required: true }),
    registrationNo: read('SCHOOL_REGISTRATION_NO'),
    address: read('SCHOOL_ADDRESS'),
    phone: read('SCHOOL_PHONE'),
    email: read('SCHOOL_EMAIL'),
    motto: read('SCHOOL_MOTTO'),
    logoPath: read('SCHOOL_LOGO_PATH'),
  }),

  storage: Object.freeze({
    // Uploaded branding images and on-server backups live here (must be writable by the app user).
    dir: path.resolve(read('STORAGE_DIR', { fallback: path.join(serverRoot, 'storage') })),
    backupDir: path.resolve(read('BACKUP_DIR', { fallback: path.join(serverRoot, 'storage', 'backups') })),
    mysqldumpPath: read('MYSQLDUMP_PATH', { fallback: 'mysqldump' }),
  }),

  finance: Object.freeze({
    receiptPrefix: read('RECEIPT_PREFIX', { fallback: 'RCT' }),
    expensePrefix: read('EXPENSE_PREFIX', { fallback: 'EXP' }),
  }),

  beem: Object.freeze({
    apiKey: readCredential('BEEM_API_KEY'),
    secretKey: readCredential('BEEM_SECRET_KEY'),
    senderId: read('BEEM_SENDER_ID')?.replace(/^(['"])(.*)\1$/, '$2'),
    overriddenFromFile: Object.freeze(beemOverriddenFromFile),
    baseUrl: read('BEEM_BASE_URL', { fallback: 'https://apisms.beem.africa/v1/send' }),
    balanceUrl: read('BEEM_BALANCE_URL', { fallback: 'https://apisms.beem.africa/public/v1/vendors/balance' }),
    timeoutMs: readInt('BEEM_TIMEOUT_MS', 15000, { min: 1000, max: 120000 }),
    paymentConfirmations: readBool('SMS_PAYMENT_CONFIRMATION', true),
    // Language of automatic SMS (payment confirmations): sw (default) or en.
    language: read('SMS_LANGUAGE', { fallback: 'sw' }) === 'en' ? 'en' : 'sw',
  }),
});

if (errors.length > 0) {
  console.error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

export default env;
