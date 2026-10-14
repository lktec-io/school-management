import { query } from '../config/db.js';

/** Extract request context (IP, user agent, actor) for audit entries. */
export function auditContext(req) {
  return {
    userId: req.user?.id ?? null,
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent')?.slice(0, 255) || null,
  };
}

/**
 * Write an audit log entry. Pass the transaction connection as `executor` when the audited
 * change happens inside withTransaction() so the log commits or rolls back with it.
 */
export async function recordAudit(
  { userId = null, action, targetTable = null, targetId = null, details = null, ipAddress = null, userAgent = null },
  executor,
) {
  await query(
    `INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, action, targetTable, targetId, details ? JSON.stringify(details) : null, ipAddress, userAgent],
    executor,
  );
}
