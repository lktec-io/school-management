import crypto from 'node:crypto';
import axios from 'axios';
import env from '../config/env.js';
import { query } from '../config/db.js';
import logger from '../utils/logger.js';
import { normalizeTzPhone } from '../utils/phone.js';
import { analyzeSms } from '../utils/smsText.js';
import { placeholders } from '../utils/sql.js';

/**
 * Beem Africa SMS gateway.
 *   POST {BEEM_BASE_URL}     Basic auth (api key : secret key)
 *     { source_addr, encoding, schedule_time, message, recipients: [{ recipient_id, dest_addr }] }
 *   GET  {BEEM_BALANCE_URL}  → { data: { credit_balance } }
 *
 * Every message is first written to sms_logs as `queued`, then dispatched; the row is updated
 * to `sent` or `failed` with the gateway response, so nothing is ever sent without an audit trail.
 */

const MAX_RECIPIENTS_PER_REQUEST = 100;
const DISPATCH_CONCURRENCY = 4;
const INSERT_CHUNK = 200;
const NOT_CONFIGURED = 'SMS gateway not configured (BEEM_API_KEY, BEEM_SECRET_KEY and BEEM_SENDER_ID are required)';

const http = axios.create({
  timeout: env.beem.timeoutMs,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

function authConfig() {
  return { auth: { username: env.beem.apiKey, password: env.beem.secretKey } };
}

export function isSmsConfigured() {
  return Boolean(env.beem.apiKey && env.beem.secretKey && env.beem.senderId);
}

function truncate(value, length) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** Run async tasks with a fixed concurrency limit. */
async function runPool(tasks, limit) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (index < tasks.length) {
      const task = tasks[index];
      index += 1;
      await task();
    }
  });
  await Promise.all(workers);
}

/**
 * Write messages to sms_logs. Invalid numbers are stored immediately as failed.
 * @param {Array<{recipient: string, message: string, studentId?: number, retryOf?: number}>} messages
 * @returns {{ batchId: string, queuedIds: number[], invalid: number }}
 */
export async function queueMessages(messages, { category = 'other', sentBy = null } = {}) {
  const batchId = crypto.randomUUID();
  let invalid = 0;
  const rows = messages.map((item) => {
    const phone = normalizeTzPhone(item.recipient);
    if (!phone) invalid += 1;
    return [
      batchId,
      phone || truncate(String(item.recipient ?? '').replace(/\s+/g, ''), 15) || 'unknown',
      item.message,
      Math.max(1, analyzeSms(item.message).segments),
      category,
      phone ? 'queued' : 'failed',
      phone ? null : 'Invalid phone number',
      item.studentId ?? null,
      sentBy,
      item.retryOf ?? null,
    ];
  });

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    await query(
      `INSERT INTO sms_logs (batch_id, recipient, message, segments, category, status, error_message, student_id, sent_by, retry_of)
       VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      chunk.flat(),
    );
  }

  const queued = await query("SELECT id FROM sms_logs WHERE batch_id = ? AND status = 'queued' ORDER BY id", [batchId]);
  return { batchId, queuedIds: queued.map((row) => row.id), invalid };
}

async function postToBeem(recipients, message) {
  if (!isSmsConfigured()) return { ok: false, data: null, requestId: null, error: NOT_CONFIGURED };
  const payload = {
    source_addr: env.beem.senderId,
    encoding: 0,
    schedule_time: '',
    message,
    recipients: recipients.map((row) => ({ recipient_id: row.id, dest_addr: row.recipient })),
  };
  try {
    const { data } = await http.post(env.beem.baseUrl, payload, authConfig());
    const ok = data?.successful === true || Number(data?.code) === 100;
    return {
      ok,
      data,
      requestId: data?.request_id ? String(data.request_id) : null,
      error: ok ? null : (data?.message || 'Message rejected by the SMS gateway'),
    };
  } catch (error) {
    const data = error.response?.data ?? null;
    const reason = data?.message || data?.data?.message || error.message;
    logger.warn('Beem SMS request failed', { status: error.response?.status, reason });
    return { ok: false, data, requestId: null, error: `Gateway error: ${reason}` };
  }
}

/** Send every queued row in `ids`; identical texts share a request (up to 100 recipients each). */
export async function dispatchQueued(ids) {
  if (!ids.length) return;
  const rows = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const slice = ids.slice(i, i + 1000);
    rows.push(...await query(
      `SELECT id, recipient, message FROM sms_logs WHERE status = 'queued' AND id IN (${placeholders(slice.length)})`,
      slice,
    ));
  }

  const byMessage = new Map();
  for (const row of rows) {
    if (!byMessage.has(row.message)) byMessage.set(row.message, []);
    byMessage.get(row.message).push(row);
  }

  const tasks = [];
  for (const [message, group] of byMessage) {
    for (let i = 0; i < group.length; i += MAX_RECIPIENTS_PER_REQUEST) {
      const chunk = group.slice(i, i + MAX_RECIPIENTS_PER_REQUEST);
      tasks.push(async () => {
        const result = await postToBeem(chunk, message);
        await query(
          `UPDATE sms_logs
              SET status = ?, provider_request_id = ?, response_data = ?, error_message = ?,
                  sent_at = ${result.ok ? 'NOW()' : 'NULL'}
            WHERE id IN (${placeholders(chunk.length)})`,
          [
            result.ok ? 'sent' : 'failed',
            result.requestId,
            result.data ? JSON.stringify(result.data) : null,
            truncate(result.error, 255),
            ...chunk.map((row) => row.id),
          ],
        );
      });
    }
  }
  await runPool(tasks, DISPATCH_CONCURRENCY);
}

/** Dispatch after the current request finishes; failures are logged, never thrown. */
export function dispatchInBackground(ids) {
  if (!ids.length) return;
  setImmediate(() => {
    dispatchQueued(ids).catch((error) => logger.error('Background SMS dispatch failed', { error: error.message }));
  });
}

async function summarize(batchId) {
  const rows = await query(
    'SELECT status, COUNT(*) AS total, SUM(segments) AS segments FROM sms_logs WHERE batch_id = ? GROUP BY status',
    [batchId],
  );
  const summary = { batchId, total: 0, sent: 0, failed: 0, queued: 0, segments: 0 };
  for (const row of rows) {
    summary[row.status] = row.total;
    summary.total += row.total;
    summary.segments += Number(row.segments);
  }
  return summary;
}

/**
 * Send one SMS and wait for the gateway result.
 * @returns {Promise<{ id: number|null, status: string, error: string|null, batchId: string }>}
 */
export async function sendSMS({ recipient, message, category = 'other', studentId = null, sentBy = null }) {
  const { batchId, queuedIds } = await queueMessages([{ recipient, message, studentId }], { category, sentBy });
  await dispatchQueued(queuedIds);
  const [row] = await query('SELECT id, status, error_message AS error FROM sms_logs WHERE batch_id = ?', [batchId]);
  return { batchId, id: row?.id ?? null, status: row?.status ?? 'failed', error: row?.error ?? null };
}

/**
 * Send to many recipients. Either `recipients` (array of phones) + one `message`, or
 * `messages` ([{ recipient, message, studentId }]) for personalised texts.
 * With `background: true` the call returns as soon as messages are queued.
 */
export async function sendBulkSMS({
  recipients = [], message, messages, category = 'other', sentBy = null, background = false,
}) {
  const items = messages ?? [...new Set(recipients)].map((recipient) => ({ recipient, message }));
  if (items.length === 0) return { batchId: null, total: 0, sent: 0, failed: 0, queued: 0, segments: 0 };
  const { batchId, queuedIds } = await queueMessages(items, { category, sentBy });
  if (background) {
    dispatchInBackground(queuedIds);
  } else {
    await dispatchQueued(queuedIds);
  }
  return summarize(batchId);
}

/** Re-send failed messages as new log rows linked through retry_of. */
export async function retryFailedMessages(ids, sentBy) {
  if (!ids.length) return { batchId: null, total: 0, queued: 0, failed: 0, sent: 0, segments: 0 };
  const failed = await query(
    `SELECT id, recipient, message, category, student_id AS studentId
       FROM sms_logs WHERE status = 'failed' AND id IN (${placeholders(ids.length)})`,
    ids,
  );
  if (failed.length === 0) return { batchId: null, total: 0, queued: 0, failed: 0, sent: 0, segments: 0 };

  const byCategory = new Map();
  for (const row of failed) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push({ recipient: row.recipient, message: row.message, studentId: row.studentId, retryOf: row.id });
  }
  const allQueued = [];
  let lastBatch = null;
  for (const [category, items] of byCategory) {
    const { batchId, queuedIds } = await queueMessages(items, { category, sentBy });
    allQueued.push(...queuedIds);
    lastBatch = batchId;
  }
  dispatchInBackground(allQueued);
  return { batchId: lastBatch, total: failed.length, queued: allQueued.length, failed: failed.length - allQueued.length, sent: 0, segments: 0 };
}

/** Live credit balance from Beem. */
export async function getBeemBalance() {
  if (!isSmsConfigured()) return { configured: false, creditBalance: null, error: NOT_CONFIGURED };
  try {
    const { data } = await http.get(env.beem.balanceUrl, authConfig());
    const raw = data?.data?.credit_balance ?? data?.credit_balance ?? data?.balance ?? null;
    return { configured: true, creditBalance: raw === null ? null : Number(raw), error: null };
  } catch (error) {
    const reason = error.response?.data?.message || error.message;
    logger.warn('Beem balance request failed', { status: error.response?.status, reason });
    return { configured: true, creditBalance: null, error: `Could not reach Beem: ${reason}` };
  }
}

/**
 * Messages still `queued` long after a restart were interrupted mid-dispatch.
 * Mark them failed so they show up for retry instead of hanging forever.
 */
export async function recoverInterruptedMessages() {
  const result = await query(
    `UPDATE sms_logs
        SET status = 'failed', error_message = 'Interrupted before sending (server restart) — retry to resend'
      WHERE status = 'queued' AND created_at < NOW() - INTERVAL 10 MINUTE`,
  );
  if (result.affectedRows) logger.warn('Marked interrupted SMS messages as failed', { count: result.affectedRows });
}
