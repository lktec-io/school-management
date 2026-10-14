import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { SCHOOL_TIMEZONE } from '../../utils/dates.js';

const BACKUP_NAME_PATTERN = /^[A-Za-z0-9_.-]+\.sql\.gz$/;

/** e.g. school_management-20261014-0930.sql.gz (Zanzibar time). */
export function backupFileName(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${env.db.name}-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}.sql.gz`;
}

/**
 * Start mysqldump for the application database. The password travels in the child's
 * environment (MYSQL_PWD), never on the command line where `ps` would reveal it.
 * --single-transaction gives a consistent InnoDB snapshot without locking the school out.
 */
export function startDump() {
  const args = [
    `--host=${env.db.host}`,
    `--port=${env.db.port}`,
    `--user=${env.db.user}`,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--no-tablespaces',
    '--set-gtid-purged=OFF',
    '--default-character-set=utf8mb4',
    '--hex-blob',
    env.db.name,
  ];
  return spawn(env.storage.mysqldumpPath, args, {
    env: { ...process.env, MYSQL_PWD: env.db.password ?? '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

export async function listBackups() {
  let entries;
  try {
    entries = await fs.readdir(env.storage.backupDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { directory: env.storage.backupDir, items: [] };
    throw error;
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !BACKUP_NAME_PATTERN.test(entry.name)) continue;
    const stat = await fs.stat(path.join(env.storage.backupDir, entry.name));
    items.push({ fileName: entry.name, bytes: stat.size, createdAt: stat.mtime.toISOString() });
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { directory: env.storage.backupDir, items };
}

export async function resolveBackupFile(fileName) {
  if (!BACKUP_NAME_PATTERN.test(fileName)) throw ApiError.badRequest('Invalid backup file name');
  const absolute = path.resolve(env.storage.backupDir, fileName);
  if (path.dirname(absolute) !== path.resolve(env.storage.backupDir)) throw ApiError.badRequest('Invalid backup file name');
  try {
    const stat = await fs.stat(absolute);
    return { absolute, bytes: stat.size };
  } catch {
    throw ApiError.notFound('Backup file not found');
  }
}
