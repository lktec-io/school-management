import mysql from 'mysql2/promise';
import env from './env.js';
import logger from '../utils/logger.js';

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  connectionLimit: env.db.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4_unicode_ci',
  timezone: env.db.timezone,
  // Keep DATE columns (e.g. date of birth) as 'YYYY-MM-DD' strings so they never shift across timezones.
  dateStrings: ['DATE'],
  decimalNumbers: false,
  supportBigNumbers: true,
  multipleStatements: false,
});

// Ensure NOW()/CURRENT_TIMESTAMP on every pooled session use the school's timezone.
pool.pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [env.db.timezone], (error) => {
    if (error) logger.error('Failed to set session time_zone', { error: error.message });
  });
});

/**
 * Run a parameterised statement and return the rows (or the ResultSetHeader for writes).
 * `executor` may be a transaction connection so the same helper works inside withTransaction().
 */
export async function query(sql, params = [], executor = pool) {
  const [result] = await executor.execute(sql, params);
  return result;
}

/** Return the first row of a SELECT or null. */
export async function queryOne(sql, params = [], executor = pool) {
  const rows = await query(sql, params, executor);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute `work(connection)` inside a transaction. Commits on success, rolls back on any error
 * and always releases the connection back to the pool.
 */
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Transaction rollback failed', { error: rollbackError.message });
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export async function closePool() {
  await pool.end();
}

export default pool;
