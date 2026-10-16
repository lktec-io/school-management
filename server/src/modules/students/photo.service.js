import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../../config/env.js';
import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { decodeImageDataUrl, detectImage } from '../../utils/images.js';
import logger from '../../utils/logger.js';

/**
 * Student passport photos, self-hosted under STORAGE_DIR/students as `<id>-<timestamp>.<ext>`.
 * They are served through the authenticated API (never as public static files) so the same
 * row-level scoping as the student record applies.
 */

const PHOTO_DIR = path.join(env.storage.dir, 'students');
const MAX_BYTES = 1.5 * 1024 * 1024;

function resolveStored(relativePath) {
  if (!relativePath) return null;
  const root = path.resolve(env.storage.dir);
  const absolute = path.resolve(root, relativePath);
  return absolute.startsWith(root + path.sep) ? absolute : null;
}

async function removeFile(relativePath) {
  const absolute = resolveStored(relativePath);
  if (absolute) await fs.rm(absolute, { force: true });
}

export async function savePhoto(studentId, dataUrl, context) {
  const student = await queryOne('SELECT id, photo_path AS photoPath FROM students WHERE id = ?', [studentId]);
  if (!student) throw ApiError.notFound('Student not found');
  const { buffer, ext } = decodeImageDataUrl(dataUrl, { maxBytes: MAX_BYTES });

  await fs.mkdir(PHOTO_DIR, { recursive: true });
  // A new name per upload busts browser caches and lets the old file be removed afterwards.
  const fileName = `${studentId}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(PHOTO_DIR, fileName), buffer, { mode: 0o640 });
  const relativePath = path.posix.join('students', fileName);
  await query('UPDATE students SET photo_path = ? WHERE id = ?', [relativePath, studentId]);
  if (student.photoPath && student.photoPath !== relativePath) {
    await removeFile(student.photoPath).catch((error) => logger.warn('Old student photo not removed', { error: error.message }));
  }
  await recordAudit({
    ...context,
    action: 'student.photo_upload',
    targetTable: 'students',
    targetId: studentId,
    details: { bytes: buffer.length, file: relativePath },
  });
  return { photoPath: relativePath };
}

export async function deletePhoto(studentId, context) {
  const student = await queryOne('SELECT id, photo_path AS photoPath FROM students WHERE id = ?', [studentId]);
  if (!student) throw ApiError.notFound('Student not found');
  if (!student.photoPath) return;
  await query('UPDATE students SET photo_path = NULL WHERE id = ?', [studentId]);
  await removeFile(student.photoPath);
  await recordAudit({ ...context, action: 'student.photo_delete', targetTable: 'students', targetId: studentId });
}

/** Read a stored photo; returns null when missing or not a valid image. */
export async function readPhoto(photoPath) {
  const absolute = resolveStored(photoPath);
  if (!absolute) return null;
  try {
    const buffer = await fs.readFile(absolute);
    const type = detectImage(buffer);
    if (type) return { buffer, mime: type.mime };
    logger.warn('Student photo is not a PNG/JPEG image', { file: photoPath });
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn('Student photo could not be read', { file: photoPath, error: error.message });
  }
  return null;
}
