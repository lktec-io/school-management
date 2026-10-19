import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { readPhoto as readStoredPhoto, removePhoto, storePhoto } from '../../utils/photoStore.js';

/**
 * Student passport photos, self-hosted under STORAGE_DIR/students. They are served through the
 * authenticated API (never as public static files) so the student record's row-level scoping applies.
 */

export async function savePhoto(studentId, dataUrl, context) {
  const student = await queryOne('SELECT id, photo_path AS photoPath FROM students WHERE id = ?', [studentId]);
  if (!student) throw ApiError.notFound('Student not found');
  const { relativePath, bytes } = await storePhoto('students', studentId, dataUrl);
  await query('UPDATE students SET photo_path = ? WHERE id = ?', [relativePath, studentId]);
  if (student.photoPath && student.photoPath !== relativePath) await removePhoto(student.photoPath);
  await recordAudit({
    ...context,
    action: 'student.photo_upload',
    targetTable: 'students',
    targetId: studentId,
    details: { bytes, file: relativePath },
  });
  return { photoPath: relativePath };
}

export async function deletePhoto(studentId, context) {
  const student = await queryOne('SELECT id, photo_path AS photoPath FROM students WHERE id = ?', [studentId]);
  if (!student) throw ApiError.notFound('Student not found');
  if (!student.photoPath) return;
  await query('UPDATE students SET photo_path = NULL WHERE id = ?', [studentId]);
  await removePhoto(student.photoPath);
  await recordAudit({ ...context, action: 'student.photo_delete', targetTable: 'students', targetId: studentId });
}

export const readPhoto = readStoredPhoto;
