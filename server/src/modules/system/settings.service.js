import env from '../../config/env.js';
import { query, withTransaction } from '../../config/db.js';
import { recordAudit } from '../../utils/audit.js';
import logger from '../../utils/logger.js';

/**
 * School identity stored in system_settings, falling back to SCHOOL_* values from .env.
 * Values are cached briefly; with PM2 cluster mode every worker refreshes within CACHE_TTL_MS
 * of a change, and the worker that saved the change refreshes immediately.
 */

export const PROFILE_FIELDS = {
  name: 'school_name',
  registrationNo: 'registration_no',
  address: 'address',
  phone: 'phone',
  email: 'email',
  website: 'website',
  instagramUrl: 'instagram_url',
  instagramReels: 'instagram_reels',
  motto: 'motto',
  headmasterName: 'headmaster_name',
  bursarName: 'bursar_name',
  vision: 'vision',
  mission: 'mission',
};

export const ASSET_FIELDS = {
  logo: 'logo_path',
  stamp: 'stamp_path',
  headmaster_signature: 'headmaster_signature_path',
  bursar_signature: 'bursar_signature_path',
};

const CACHE_TTL_MS = 15000;
let cache = { at: 0, value: null };
let warnedMissingTable = false;

function envDefaults() {
  return {
    name: env.school.name,
    registrationNo: env.school.registrationNo ?? null,
    address: env.school.address ?? null,
    phone: env.school.phone ?? null,
    email: env.school.email ?? null,
    website: null,
    instagramUrl: null,
    instagramReels: null,
    motto: env.school.motto ?? null,
    headmasterName: null,
    bursarName: null,
    vision: null,
    mission: null,
  };
}

export function invalidateSettingsCache() {
  cache = { at: 0, value: null };
}

async function readRows() {
  try {
    return await query('SELECT setting_key AS settingKey, setting_value AS settingValue, updated_at AS updatedAt FROM system_settings');
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      if (!warnedMissingTable) {
        logger.warn('system_settings table missing — run `npm run db:migrate`; using .env school details');
        warnedMissingTable = true;
      }
      return [];
    }
    throw error;
  }
}

/** Full settings: { profile, assets: { logo: relativePath|null, ... }, updatedAt }. */
export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const rows = await readRows();
  const byKey = new Map(rows.map((row) => [row.settingKey, row]));
  const profile = envDefaults();
  for (const [field, key] of Object.entries(PROFILE_FIELDS)) {
    const value = byKey.get(key)?.settingValue;
    if (value !== undefined && value !== null && value !== '') profile[field] = value;
  }
  const assets = {};
  for (const [kind, key] of Object.entries(ASSET_FIELDS)) assets[kind] = byKey.get(key)?.settingValue || null;
  const updatedAt = rows.reduce((latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest), null);
  const value = { profile, assets, updatedAt };
  cache = { at: Date.now(), value };
  return value;
}

export async function getSchoolProfile() {
  return (await getSettings()).profile;
}

export const DEFAULT_REGISTRATION_PREFIX = 'S1819';
export const MAX_INSTAGRAM_REELS = 3;
const REEL_CODE = /^[A-Za-z0-9_-]{5,40}$/;

/**
 * Prefix of new student registration numbers (S1819/2026/001): the school's official registration
 * number from School Settings, e.g. "S1819" or "Reg. No. S1819" → "S1819". "/" separates the parts of a
 * registration number, so slashes inside the school's number become hyphens ("ZEC/PS/0142" → "ZEC-PS-0142").
 */
export function prefixFromRegistrationNo(registrationNo) {
  const tokens = String(registrationNo ?? '').toUpperCase().split(/[\s:#,]+/)
    .map((token) => token.replace(/\//g, '-').replace(/[^A-Z0-9-]/g, '').replace(/^-+|-+$/g, ''))
    .filter((token) => token && token.length <= 20);
  // Words such as "Reg." / "No." are skipped by preferring the last part that contains a digit.
  const numbered = tokens.filter((token) => /\d/.test(token));
  return numbered.at(-1) || (tokens.length === 1 ? tokens[0] : DEFAULT_REGISTRATION_PREFIX);
}

export async function registrationPrefix() {
  return prefixFromRegistrationNo((await getSchoolProfile()).registrationNo);
}

/**
 * Reel links or codes, one per line → ["DdgH5x0gtdl", …]. Accepts full links such as
 * https://www.instagram.com/reel/DdgH5x0gtdl/?rpxt=… Returns { codes, invalid } so callers can report bad lines.
 */
export function parseReelCodes(text) {
  const codes = [];
  const invalid = [];
  for (const line of String(text ?? '').split(/[\r\n]+/).map((value) => value.trim()).filter(Boolean)) {
    const fromUrl = line.match(/^https:\/\/(?:www\.)?instagram\.com\/(?:reels?|p)\/([A-Za-z0-9_-]{5,40})(?:[/?#].*)?$/i);
    const code = fromUrl ? fromUrl[1] : REEL_CODE.test(line) ? line : null;
    if (code) {
      if (!codes.includes(code)) codes.push(code);
    } else {
      invalid.push(line);
    }
  }
  return { codes, invalid };
}

/** Save profile fields; null/empty reverts a field to its .env default. */
export async function updateProfile(data, user, context) {
  const before = (await getSettings({ fresh: true })).profile;
  await withTransaction(async (connection) => {
    for (const [field, key] of Object.entries(PROFILE_FIELDS)) {
      if (data[field] === undefined) continue;
      if (data[field] === null || data[field] === '') {
        await query('DELETE FROM system_settings WHERE setting_key = ?', [key], connection);
      } else {
        await query(
          `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          [key, data[field], user.id],
          connection,
        );
      }
    }
    await recordAudit({ ...context, action: 'system.settings_update', targetTable: 'system_settings', details: { before, changes: data } }, connection);
  });
  invalidateSettingsCache();
  return getSettings({ fresh: true });
}

export async function setAssetPath(kind, relativePath, user) {
  const key = ASSET_FIELDS[kind];
  if (relativePath) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, relativePath, user.id],
    );
  } else {
    await query('DELETE FROM system_settings WHERE setting_key = ?', [key]);
  }
  invalidateSettingsCache();
}
