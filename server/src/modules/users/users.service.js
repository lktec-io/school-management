import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { paginated } from '../../utils/pagination.js';
import { generateTemporaryPassword } from '../../utils/passwords.js';
import { buildUpdateSet, likeContains, rethrowDuplicate, withBooleans } from '../../utils/sql.js';

const USER_SELECT = `SELECT u.id, u.full_name AS fullName, u.email, u.phone, u.role, u.status,
    u.must_change_password AS mustChangePassword, u.last_login_at AS lastLoginAt, u.created_at AS createdAt
  FROM users u`;

const USER_COLUMNS = { fullName: 'full_name', email: 'email', phone: 'phone', role: 'role', status: 'status' };
const DUPLICATE_MESSAGE = 'Another account already uses this email or phone number';

async function findUser(id, executor) {
  const user = await queryOne(`${USER_SELECT} WHERE u.id = ?`, [id], executor);
  if (!user) throw ApiError.notFound('User not found');
  return withBooleans(user, ['mustChangePassword']);
}

export async function listUsers({ role, status, search }, pagination) {
  const where = [];
  const params = [];
  if (role) {
    where.push('u.role = ?');
    params.push(role);
  }
  if (status) {
    where.push('u.status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const term = likeContains(search);
    params.push(term, term, term);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { total } = await queryOne(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
  const rows = await query(
    `${USER_SELECT} ${whereSql} ORDER BY u.full_name LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
    params,
  );
  return paginated(withBooleans(rows, ['mustChangePassword']), total, pagination);
}

export async function createUser(data, context) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, env.auth.bcryptSaltRounds);
  let result;
  try {
    result = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status, must_change_password)
       VALUES (?, ?, ?, ?, ?, 'active', 1)`,
      [data.fullName, data.email ?? null, data.phone ?? null, passwordHash, data.role],
    );
  } catch (error) {
    rethrowDuplicate(error, DUPLICATE_MESSAGE);
  }
  await recordAudit({
    ...context,
    action: 'user.create',
    targetTable: 'users',
    targetId: result.insertId,
    details: { fullName: data.fullName, email: data.email, phone: data.phone, role: data.role },
  });
  return { user: await findUser(result.insertId), temporaryPassword };
}

export async function updateUser(id, data, actor, context) {
  const before = await findUser(id);
  const roleChanging = data.role !== undefined && data.role !== before.role;
  const statusChanging = data.status !== undefined && data.status !== before.status;

  if (id === actor.id && (roleChanging || statusChanging)) {
    throw ApiError.forbidden('You cannot change your own role or account status');
  }

  const email = data.email !== undefined ? data.email : before.email;
  const phone = data.phone !== undefined ? data.phone : before.phone;
  if (!email && !phone) {
    throw ApiError.badRequest('Please correct the highlighted fields', { email: 'An email or phone number is required' });
  }

  if (roleChanging && before.role === 'teacher') {
    const { total } = await queryOne(
      `SELECT (SELECT COUNT(*) FROM teacher_assignments WHERE teacher_id = ?)
            + (SELECT COUNT(*) FROM classes WHERE class_teacher_id = ?) AS total`,
      [id, id],
    );
    if (total > 0) throw ApiError.conflict('Remove this teacher\'s subject and class-teacher assignments before changing the role');
  }
  if (roleChanging && before.role === 'parent') {
    const { total } = await queryOne('SELECT COUNT(*) AS total FROM students WHERE parent_user_id = ?', [id]);
    if (total > 0) throw ApiError.conflict('Unlink this parent from their students before changing the role');
  }

  const { sets, params } = buildUpdateSet(data, USER_COLUMNS);
  // Role or status changes revoke every active session of that user immediately.
  if (roleChanging || statusChanging) sets.push('token_version = token_version + 1');
  try {
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, DUPLICATE_MESSAGE);
  }
  await recordAudit({ ...context, action: 'user.update', targetTable: 'users', targetId: id, details: { before, changes: data } });
  return findUser(id);
}

export async function resetPassword(id, actor, context) {
  if (id === actor.id) throw ApiError.badRequest('Use "Change password" to update your own password');
  await findUser(id);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, env.auth.bcryptSaltRounds);
  await withTransaction(async (connection) => {
    await query(
      `UPDATE users
          SET password_hash = ?, must_change_password = 1, token_version = token_version + 1,
              failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?`,
      [passwordHash, id],
      connection,
    );
    await recordAudit({ ...context, action: 'user.reset_password', targetTable: 'users', targetId: id }, connection);
  });
  return { user: await findUser(id), temporaryPassword };
}
