import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../config/env.js';
import { ApiError } from '../middleware/errorHandler.js';
import { decodeImageDataUrl, detectImage } from './images.js';
import logger from './logger.js';

/**
 * Self-hosted photos under STORAGE_DIR/<folder>/<prefix>-<timestamp>.<ext>.
 * A new file name per upload busts browser caches; paths are stored relative to STORAGE_DIR and
 * always resolved back inside it, so a tampered path can never read outside the storage folder.
 */
const MAX_BYTES = 1.5 * 1024 * 1024;

function resolveStored(relativePath) {
  if (!relativePath) return null;
  const root = path.resolve(env.storage.dir);
  const absolute = path.resolve(root, relativePath);
  return absolute.startsWith(root + path.sep) ? absolute : null;
}

export const MAX_PHOTO_BYTES = MAX_BYTES;

/** Validate raw upload bytes (multipart file) the same way as data URLs: real PNG/JPEG, ≤1.5 MB. */
export function validatePhotoBuffer(buffer) {
  if (!buffer?.length || buffer.length > MAX_BYTES) {
    throw ApiError.badRequest('Image must be smaller than 1.5 MB', { photo: 'File too large or empty' });
  }
  const type = detectImage(buffer);
  if (!type) throw ApiError.badRequest('The file is not a valid PNG or JPEG image', { photo: 'Unrecognised image data' });
  return { buffer, ...type };
}

/**
 * Write an uploaded photo — either a multipart file `{ buffer }` or a `data:image/...;base64` URL —
 * after validating it; returns its relative path.
 */
export async function storePhoto(folder, prefix, upload) {
  const { buffer, ext } = typeof upload === 'string'
    ? decodeImageDataUrl(upload, { maxBytes: MAX_BYTES })
    : validatePhotoBuffer(upload?.buffer);
  const dir = path.join(env.storage.dir, folder);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${prefix}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), buffer, { mode: 0o640 });
  return { relativePath: path.posix.join(folder, fileName), bytes: buffer.length };
}

export async function removePhoto(relativePath) {
  const absolute = resolveStored(relativePath);
  if (!absolute) return;
  await fs.rm(absolute, { force: true }).catch((error) => logger.warn('Old photo not removed', { file: relativePath, error: error.message }));
}

/** Read a stored photo; null when missing or not a valid image. */
export async function readPhoto(relativePath) {
  const absolute = resolveStored(relativePath);
  if (!absolute) return null;
  try {
    const buffer = await fs.readFile(absolute);
    const type = detectImage(buffer);
    if (type) return { buffer, mime: type.mime };
    logger.warn('Stored photo is not a PNG/JPEG image', { file: relativePath });
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn('Stored photo could not be read', { file: relativePath, error: error.message });
  }
  return null;
}

/** Cache-busting version token for a stored photo (its file name without extension). */
export function photoVersion(relativePath) {
  return path.posix.basename(relativePath).replace(/\.[a-z]+$/, '');
}

/** Send a stored photo; private caching because every photo URL needs a session. */
export function sendPhoto(res, photo) {
  res.set({
    'Content-Type': photo.mime,
    'Content-Length': photo.buffer.length,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(photo.buffer);
}
