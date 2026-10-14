import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { paginated } from '../../utils/pagination.js';
import { likeContains } from '../../utils/sql.js';

const LOG_SELECT = `SELECT a.id, a.user_id AS userId, u.full_name AS userName, u.role AS userRole, a.action,
    a.target_table AS targetTable, a.target_id AS targetId, a.details, a.ip_address AS ipAddress,
    a.user_agent AS userAgent, a.created_at AS createdAt
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id`;

function buildFilters(filters) {
  const where = [];
  const params = [];
  const add = (sql, ...values) => {
    where.push(sql);
    params.push(...values);
  };
  if (filters.userId) add('a.user_id = ?', filters.userId);
  if (filters.action) {
    // "payment" or "payment." filters a whole group; "payment.reverse" matches exactly.
    if (filters.action.includes('.') && !filters.action.endsWith('.')) add('a.action = ?', filters.action);
    else add('a.action LIKE ?', `${filters.action.replace(/\.$/, '').replace(/[\\%_]/g, (c) => `\\${c}`)}.%`);
  }
  if (filters.targetTable) add('a.target_table = ?', filters.targetTable);
  if (filters.dateFrom) add('a.created_at >= ?', `${filters.dateFrom} 00:00:00`);
  if (filters.dateTo) add('a.created_at <= ?', `${filters.dateTo} 23:59:59`);
  if (filters.ipAddress) add('a.ip_address = ?', filters.ipAddress);
  if (filters.search) {
    const term = likeContains(filters.search);
    add(`(a.action LIKE ? OR a.target_table LIKE ? OR a.ip_address LIKE ? OR u.full_name LIKE ?
          OR CAST(a.details AS CHAR) LIKE ?)`, term, term, term, term, term);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function listLogs(filters, pagination) {
  const { whereSql, params } = buildFilters(filters);
  const [{ total }, rows] = await Promise.all([
    queryOne(`SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`, params),
    query(`${LOG_SELECT} ${whereSql} ORDER BY a.id DESC LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`, params),
  ]);
  return paginated(rows, total, pagination);
}

export async function getLog(id) {
  const row = await queryOne(`${LOG_SELECT} WHERE a.id = ?`, [id]);
  if (!row) throw ApiError.notFound('Audit entry not found');
  return row;
}

/** Distinct actions (with counts) and target tables, for the filter dropdowns. */
export async function listFacets() {
  const [actions, tables] = await Promise.all([
    query('SELECT action, COUNT(*) AS total FROM audit_logs GROUP BY action ORDER BY action'),
    query('SELECT DISTINCT target_table AS targetTable FROM audit_logs WHERE target_table IS NOT NULL ORDER BY target_table'),
  ]);
  const groups = new Map();
  for (const row of actions) {
    const group = row.action.split('.')[0];
    groups.set(group, (groups.get(group) ?? 0) + row.total);
  }
  return {
    actions,
    groups: [...groups.entries()].map(([group, total]) => ({ group, total })),
    targetTables: tables.map((row) => row.targetTable),
  };
}
