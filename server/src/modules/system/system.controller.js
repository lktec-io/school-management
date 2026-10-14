import { createReadStream } from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';
import env from '../../config/env.js';
import { queryOne } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { isSmsConfigured } from '../../services/smsService.js';
import { auditContext, recordAudit } from '../../utils/audit.js';
import logger from '../../utils/logger.js';
import { parseId, validator } from '../../utils/validator.js';
import * as announcements from './announcements.service.js';
import * as backups from './backup.service.js';
import * as branding from './branding.service.js';
import { getSettings, updateProfile } from './settings.service.js';

export const getSettingsHandler = asyncHandler(async (req, res) => {
  const [settings, assets] = await Promise.all([getSettings({ fresh: true }), branding.assetStatus()]);
  res.json({ success: true, data: { profile: settings.profile, ...assets } });
});

export const updateSettingsHandler = asyncHandler(async (req, res) => {
  const data = validator(req.body, { partial: true })
    .string('name', { required: true, min: 3, max: 150 })
    .string('registrationNo', { max: 60 })
    .string('address', { max: 255 })
    .string('phone', { max: 60 })
    .email('email')
    .string('website', { max: 150, pattern: /^https?:\/\/\S+$/i, patternMessage: 'Start with http:// or https://' })
    .string('motto', { max: 150 })
    .string('headmasterName', { max: 150 })
    .string('bursarName', { max: 150 })
    .string('vision', { max: 600, multiline: true })
    .string('mission', { max: 600, multiline: true })
    .result();
  const settings = await updateProfile(data, req.user, auditContext(req));
  res.json({ success: true, data: { profile: settings.profile }, message: 'School settings saved' });
});

export const uploadAsset = asyncHandler(async (req, res) => {
  const result = await branding.saveAsset(req.params.kind, req.body?.dataUrl, req.user, auditContext(req));
  res.json({ success: true, data: result, message: 'Image uploaded' });
});

export const deleteAsset = asyncHandler(async (req, res) => {
  await branding.deleteAsset(req.params.kind, req.user, auditContext(req));
  res.json({ success: true, message: 'Image removed' });
});

/** Serve a branding image. The logo is public (login page); stamp/signatures are Headmaster-only. */
export const serveAsset = asyncHandler(async (req, res) => {
  const kind = req.params.kind ?? 'logo';
  if (!branding.ASSET_KINDS.includes(kind)) throw ApiError.notFound('Unknown branding asset');
  if (kind !== 'logo' && req.user?.role !== 'admin') throw ApiError.forbidden();
  const asset = await branding.readAsset(kind);
  if (!asset) throw ApiError.notFound('No image uploaded');
  res.setHeader('Content-Type', asset.mime);
  res.setHeader('Cache-Control', kind === 'logo' ? 'public, max-age=300' : 'private, no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.send(asset.buffer);
});

/**
 * Stream a fresh gzip-compressed mysqldump to the browser. Headers are sent only once
 * mysqldump produces output, so failures (missing binary, bad credentials) return JSON errors.
 */
export const downloadBackup = asyncHandler(async (req, res) => {
  const fileName = backups.backupFileName();
  const started = Date.now();
  let bytes = 0;

  await new Promise((resolve, reject) => {
    const child = backups.startDump();
    const gzip = zlib.createGzip({ level: 6 });
    let stderr = '';
    let streaming = false;

    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on('error', (error) => {
      if (streaming) {
        res.destroy(error);
        return;
      }
      reject(new ApiError(500, error.code === 'ENOENT'
        ? 'mysqldump was not found. Install the MySQL client tools or set MYSQLDUMP_PATH.'
        : `Backup failed: ${error.message}`, { code: 'BACKUP_FAILED' }));
    });
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
    });
    child.stdout.once('data', (firstChunk) => {
      streaming = true;
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      gzip.pipe(res);
      gzip.write(firstChunk);
      // pipe() applies backpressure and ends the gzip stream when mysqldump finishes.
      child.stdout.pipe(gzip);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const reason = stderr.split('\n').map((line) => line.trim()).filter((line) => line && !/Deprecated program name|MYSQL_PWD/i.test(line)).pop();
        logger.error('mysqldump failed', { code, stderr: stderr.slice(-1000) });
        if (streaming) {
          res.destroy(new Error('mysqldump exited with an error'));
          reject(new Error('mysqldump exited with an error'));
        } else {
          reject(new ApiError(500, `Backup failed: ${reason || `mysqldump exited with code ${code}`}`, { code: 'BACKUP_FAILED' }));
        }
        return;
      }
      if (!streaming) {
        reject(new ApiError(500, 'Backup produced no output', { code: 'BACKUP_FAILED' }));
        return;
      }
      resolve();
    });
  });

  await recordAudit({
    ...auditContext(req),
    action: 'system.backup_download',
    targetTable: 'system',
    details: { fileName, uncompressedBytes: bytes, durationMs: Date.now() - started },
  });
});

export const listBackups = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await backups.listBackups() });
});

export const downloadStoredBackup = asyncHandler(async (req, res) => {
  const { absolute, bytes } = await backups.resolveBackupFile(req.params.file);
  await recordAudit({ ...auditContext(req), action: 'system.backup_file_download', targetTable: 'system', details: { fileName: req.params.file, bytes } });
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Length', bytes);
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.file}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  createReadStream(absolute).on('error', (error) => res.destroy(error)).pipe(res);
});

function validateAnnouncement(body, { partial = false } = {}) {
  return validator(body, { partial })
    .string('title', { required: true, min: 3, max: 160 })
    .string('body', { required: true, min: 3, max: 4000, multiline: true })
    .oneOf('category', announcements.ANNOUNCEMENT_CATEGORIES)
    .boolean('isPublished')
    .date('publishedAt')
    .date('expiresAt')
    .result();
}

export const listAnnouncements = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await announcements.listAll() });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const item = await announcements.create(validateAnnouncement(req.body), req.user, auditContext(req));
  res.status(201).json({ success: true, data: item, message: 'Announcement saved' });
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const item = await announcements.update(parseId(req.params.id), validateAnnouncement(req.body, { partial: true }), req.user, auditContext(req));
  res.json({ success: true, data: item, message: 'Announcement updated' });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  await announcements.remove(parseId(req.params.id), auditContext(req));
  res.json({ success: true, message: 'Announcement deleted' });
});

export const publicAnnouncements = asyncHandler(async (req, res) => {
  // Revalidate on every visit (cheap 304 via ETag) so new notices appear immediately.
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ success: true, data: await announcements.listPublic(req.query.limit) });
});

export const systemInfo = asyncHandler(async (req, res) => {
  const [db, size, list] = await Promise.all([
    queryOne('SELECT VERSION() AS version'),
    queryOne(
      `SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes, COUNT(*) AS tables
         FROM information_schema.tables WHERE table_schema = ?`,
      [env.db.name],
    ),
    backups.listBackups(),
  ]);
  res.json({
    success: true,
    data: {
      environment: env.nodeEnv,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      hostname: os.hostname(),
      database: { name: env.db.name, version: db.version, bytes: Number(size.bytes), tables: size.tables },
      smsConfigured: isSmsConfigured(),
      storageDir: env.storage.dir,
      backupDir: list.directory,
      lastBackup: list.items[0] ?? null,
      backupsStored: list.items.length,
    },
  });
});
