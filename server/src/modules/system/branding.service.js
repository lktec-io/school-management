import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { decodeImageDataUrl, detectImage } from '../../utils/images.js';
import logger from '../../utils/logger.js';
import { ASSET_FIELDS, getSettings, setAssetPath } from './settings.service.js';

/**
 * Branding images (logo, official stamp, signatures) uploaded as data URLs and stored under
 * STORAGE_DIR/branding. Only PNG/JPEG are accepted — the formats PDFKit can embed — and the
 * file signature is checked, not just the declared MIME type.
 */

export const ASSET_KINDS = Object.keys(ASSET_FIELDS);
const BRANDING_DIR = path.join(env.storage.dir, 'branding');

function resolveStored(relativePath) {
  const absolute = path.resolve(env.storage.dir, relativePath);
  if (!absolute.startsWith(path.resolve(env.storage.dir) + path.sep)) return null;
  return absolute;
}

export async function saveAsset(kind, dataUrl, user, context) {
  if (!ASSET_KINDS.includes(kind)) throw ApiError.notFound('Unknown branding asset');
  const { buffer, ext } = decodeImageDataUrl(dataUrl);
  await fs.mkdir(BRANDING_DIR, { recursive: true });
  const fileName = `${kind}.${ext}`;
  // Remove a previous upload in the other format so only one file per kind exists.
  for (const other of ['png', 'jpg']) {
    if (other !== ext) await fs.rm(path.join(BRANDING_DIR, `${kind}.${other}`), { force: true });
  }
  await fs.writeFile(path.join(BRANDING_DIR, fileName), buffer, { mode: 0o640 });
  const relativePath = path.posix.join('branding', fileName);
  await setAssetPath(kind, relativePath, user);
  await recordAudit({ ...context, action: 'system.branding_upload', targetTable: 'system_settings', details: { kind, bytes: buffer.length, file: relativePath } });
  return { kind, path: relativePath, bytes: buffer.length };
}

export async function deleteAsset(kind, user, context) {
  if (!ASSET_KINDS.includes(kind)) throw ApiError.notFound('Unknown branding asset');
  const { assets } = await getSettings({ fresh: true });
  if (assets[kind]) {
    const absolute = resolveStored(assets[kind]);
    if (absolute) await fs.rm(absolute, { force: true });
  }
  await setAssetPath(kind, null, user);
  await recordAudit({ ...context, action: 'system.branding_delete', targetTable: 'system_settings', details: { kind } });
}

/** Read one asset; the logo falls back to SCHOOL_LOGO_PATH from .env. */
export async function readAsset(kind) {
  const { assets } = await getSettings();
  const candidates = [];
  if (assets[kind]) candidates.push(resolveStored(assets[kind]));
  if (kind === 'logo' && env.school.logoPath) candidates.push(path.resolve(env.school.logoPath));
  for (const file of candidates.filter(Boolean)) {
    try {
      const buffer = await fs.readFile(file);
      const type = detectImage(buffer);
      if (type) return { buffer, mime: type.mime };
      logger.warn('Branding file is not a PNG/JPEG image', { kind, file });
    } catch (error) {
      if (error.code !== 'ENOENT') logger.warn('Branding file could not be read', { kind, file, error: error.message });
    }
  }
  return null;
}

/** All branding images as Buffers (null when not uploaded), for PDF rendering. */
export async function loadBranding() {
  const [logo, stamp, headmasterSignature, bursarSignature] = await Promise.all(
    ['logo', 'stamp', 'headmaster_signature', 'bursar_signature'].map((kind) => readAsset(kind)),
  );
  return {
    logo: logo?.buffer ?? null,
    stamp: stamp?.buffer ?? null,
    headmasterSignature: headmasterSignature?.buffer ?? null,
    bursarSignature: bursarSignature?.buffer ?? null,
  };
}

export async function assetStatus() {
  const { assets, updatedAt } = await getSettings({ fresh: true });
  const status = {};
  for (const kind of ASSET_KINDS) {
    status[kind] = { uploaded: Boolean(assets[kind]), path: assets[kind] };
  }
  if (!assets.logo && env.school.logoPath) status.logo = { uploaded: false, path: env.school.logoPath, fromEnv: true };
  return { assets: status, version: updatedAt ? new Date(updatedAt).getTime() : 0 };
}
