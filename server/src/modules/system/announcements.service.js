import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { todayInSchoolTz } from '../../utils/dates.js';
import { buildUpdateSet, withBooleans } from '../../utils/sql.js';

export const ANNOUNCEMENT_CATEGORIES = ['general', 'admissions', 'examinations', 'events', 'fees'];

const SELECT = `SELECT a.id, a.title, a.body, a.category, a.is_published AS isPublished,
    a.published_at AS publishedAt, a.expires_at AS expiresAt, u.full_name AS createdByName, a.updated_at AS updatedAt
  FROM announcements a JOIN users u ON u.id = a.created_by`;

const COLUMNS = {
  title: 'title', body: 'body', category: 'category', isPublished: 'is_published', publishedAt: 'published_at', expiresAt: 'expires_at',
};

async function find(id) {
  const row = await queryOne(`${SELECT} WHERE a.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Announcement not found');
  return withBooleans(row, ['isPublished']);
}

/** Public landing page: published, already live and not yet expired. */
export async function listPublic(limit = 6) {
  const today = todayInSchoolTz();
  const rows = await query(
    `SELECT a.id, a.title, a.body, a.category, a.published_at AS publishedAt
       FROM announcements a
      WHERE a.is_published = 1 AND a.published_at <= ? AND (a.expires_at IS NULL OR a.expires_at >= ?)
      ORDER BY a.published_at DESC, a.id DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 6, 1), 20)}`,
    [today, today],
  );
  return rows;
}

export async function listAll() {
  return withBooleans(await query(`${SELECT} ORDER BY a.published_at DESC, a.id DESC LIMIT 200`), ['isPublished']);
}

function assertDates(publishedAt, expiresAt) {
  if (expiresAt && publishedAt && expiresAt < publishedAt) {
    throw ApiError.badRequest('Please correct the highlighted fields', { expiresAt: 'Must be on or after the publish date' });
  }
}

export async function create(data, user, context) {
  const publishedAt = data.publishedAt ?? todayInSchoolTz();
  assertDates(publishedAt, data.expiresAt);
  const result = await query(
    `INSERT INTO announcements (title, body, category, is_published, published_at, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.title, data.body, data.category ?? 'general', Number(data.isPublished ?? true), publishedAt, data.expiresAt ?? null, user.id],
  );
  await recordAudit({ ...context, action: 'announcement.create', targetTable: 'announcements', targetId: result.insertId, details: data });
  return find(result.insertId);
}

export async function update(id, data, user, context) {
  const before = await find(id);
  assertDates(data.publishedAt ?? before.publishedAt, data.expiresAt !== undefined ? data.expiresAt : before.expiresAt);
  const { sets, params } = buildUpdateSet(data, COLUMNS);
  sets.push('updated_by = ?');
  await query(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ?`, [...params, user.id, id]);
  await recordAudit({ ...context, action: 'announcement.update', targetTable: 'announcements', targetId: id, details: { before, changes: data } });
  return find(id);
}

export async function remove(id, context) {
  const before = await find(id);
  await query('DELETE FROM announcements WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'announcement.delete', targetTable: 'announcements', targetId: id, details: before });
}
