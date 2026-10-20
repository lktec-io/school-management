import { query, queryOne } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import * as smsService from '../../services/smsService.js';
import { recordAudit } from '../../utils/audit.js';
import { paginated } from '../../utils/pagination.js';
import { normalizeTzPhone } from '../../utils/phone.js';
import { MAX_SEGMENTS, analyzeSms } from '../../utils/smsText.js';
import { likeContains, placeholders, round } from '../../utils/sql.js';
import { getCurrentPeriod } from '../academics/calendar.service.js';
import { computeClassResults, findExam } from '../exams/exams.service.js';
import { computeTermBalances } from '../finance/balances.service.js';
import { formatTzs } from '../finance/payments.service.js';
import { getSchoolProfile } from '../system/settings.service.js';

export const TARGET_TYPES = ['all_parents', 'class', 'defaulters', 'students', 'exam_results', 'custom'];
const MAX_RECIPIENTS = 3000;

const STUDENT_FIELDS = ['parent_name', 'student_name', 'first_name', 'reg_no', 'class', 'school'];
const FEE_FIELDS = ['balance', 'term'];
const RESULT_FIELDS = ['exam', 'average', 'grade', 'division', 'position', 'class_size', 'remark'];

export const PLACEHOLDERS = {
  all_parents: [...STUDENT_FIELDS, ...FEE_FIELDS],
  class: [...STUDENT_FIELDS, ...FEE_FIELDS],
  defaulters: [...STUDENT_FIELDS, ...FEE_FIELDS],
  students: [...STUDENT_FIELDS, ...FEE_FIELDS],
  exam_results: [...STUDENT_FIELDS, ...RESULT_FIELDS],
  custom: ['school'],
};

const DEFAULT_CATEGORY = {
  all_parents: 'announcement',
  class: 'announcement',
  defaulters: 'fee_reminder',
  students: 'announcement',
  exam_results: 'results',
  custom: 'announcement',
};

function usedPlaceholders(message) {
  return [...new Set([...message.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]))];
}

function render(message, context) {
  return message.replace(/\{([a-z_]+)\}/g, (whole, key) => (context[key] !== undefined && context[key] !== null ? String(context[key]) : whole));
}

function studentContext(row, schoolName) {
  return {
    // Guardian names go out in capitals ("KUSEKWA KULWA"), as on official school notices.
    parent_name: String(row.parentName ?? '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('sw-TZ'),
    student_name: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
    first_name: row.firstName,
    reg_no: row.registrationNumber,
    class: row.streamName ? `${row.className} ${row.streamName}` : row.className,
    school: schoolName,
  };
}

async function loadStudents(where, params) {
  return query(
    `SELECT s.id, s.registration_number AS registrationNumber, s.first_name AS firstName, s.middle_name AS middleName,
            s.last_name AS lastName, s.parent_name AS parentName, s.parent_phone AS parentPhone,
            c.class_name AS className, st.stream_name AS streamName
       FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN streams st ON st.id = s.stream_id
      WHERE ${where}
      ORDER BY c.sort_order, st.display_order, st.stream_name, s.first_name`,
    params,
  );
}

async function resolveTermId(termId, required) {
  if (termId) return termId;
  const { term } = await getCurrentPeriod();
  if (!term && required) throw ApiError.badRequest('No current term is set; choose a term for fee details');
  return term?.id ?? null;
}

/** Attach {balance} / {term} values to student recipients. */
async function withFeeContext(recipients, termId) {
  if (recipients.length === 0) return recipients;
  const balances = await computeTermBalances(termId, { studentIds: recipients.map((r) => r.studentId), statuses: null });
  const term = await queryOne(
    'SELECT t.term_name AS termName, ay.year_label AS yearLabel FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id WHERE t.id = ?',
    [termId],
  );
  const byStudent = new Map(balances.map((row) => [row.studentId, row]));
  return recipients.map((recipient) => {
    const balance = byStudent.get(recipient.studentId);
    return {
      ...recipient,
      context: {
        ...recipient.context,
        balance: formatTzs(Math.max(0, balance?.balance ?? 0)),
        term: term ? `${term.termName} ${term.yearLabel}` : '',
      },
      balance: balance?.balance ?? 0,
    };
  });
}

/**
 * Turn a target description into [{ studentId, phone, context }].
 * Fee placeholders are only computed when the message uses them (or the target needs balances).
 */
async function resolveRecipients(target, message, user) {
  const used = usedPlaceholders(message);
  const allowed = PLACEHOLDERS[target.type];
  const unknown = used.filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw ApiError.badRequest(`Unknown placeholder(s) for this audience: ${unknown.map((k) => `{${k}}`).join(', ')}`, {
      message: `Allowed: ${allowed.map((k) => `{${k}}`).join(' ')}`,
    });
  }
  const needsFees = used.some((key) => FEE_FIELDS.includes(key));
  const { name: schoolName } = await getSchoolProfile();
  const toRecipient = (row) => ({ studentId: row.id, phone: row.parentPhone, context: studentContext(row, schoolName) });
  let recipients;

  switch (target.type) {
    case 'custom': {
      recipients = (target.phones ?? []).map((phone) => ({ studentId: null, phone, context: { school: schoolName } }));
      break;
    }
    case 'all_parents': {
      recipients = (await loadStudents("s.status = 'active'", [])).map(toRecipient);
      break;
    }
    case 'class': {
      const params = [target.classId];
      let where = "s.status = 'active' AND s.class_id = ?";
      if (target.streamId) {
        where += ' AND s.stream_id = ?';
        params.push(target.streamId);
      }
      recipients = (await loadStudents(where, params)).map(toRecipient);
      break;
    }
    case 'students': {
      if (!target.studentIds?.length) throw ApiError.badRequest('Select at least one student');
      recipients = (await loadStudents(`s.id IN (${placeholders(target.studentIds.length)})`, target.studentIds)).map(toRecipient);
      break;
    }
    case 'defaulters': {
      const termId = await resolveTermId(target.termId, true);
      const balances = await computeTermBalances(termId, { classId: target.classId, streamId: target.streamId });
      const threshold = Math.max(Number(target.minBalance) || 0, 0.01);
      const ids = balances.filter((row) => row.balance >= threshold).map((row) => row.studentId);
      recipients = ids.length ? (await loadStudents(`s.id IN (${placeholders(ids.length)})`, ids)).map(toRecipient) : [];
      recipients = await withFeeContext(recipients, termId);
      break;
    }
    case 'exam_results': {
      if (user.role !== 'admin') throw ApiError.forbidden('Only the Headmaster can send examination results');
      const exam = await findExam(target.examId);
      if (exam.status !== 'published') throw ApiError.conflict('Publish the examination before sending results to parents');
      const results = await computeClassResults(exam, target.classId, { streamId: target.streamId ?? null });
      const ranked = results.students.filter((row) => row.averagePct !== null);
      const rows = ranked.length
        ? await loadStudents(`s.id IN (${placeholders(ranked.length)})`, ranked.map((row) => row.studentId))
        : [];
      const byId = new Map(rows.map((row) => [row.id, row]));
      recipients = ranked.filter((row) => byId.has(row.studentId)).map((row) => {
        const student = byId.get(row.studentId);
        return {
          studentId: row.studentId,
          phone: student.parentPhone,
          context: {
            ...studentContext(student, schoolName),
            exam: `${exam.name} ${exam.termName} ${exam.yearLabel}`,
            average: `${round(row.averagePct, 1)}%`,
            grade: row.overall.averageGrade ?? '-',
            division: row.overall.value,
            position: `${row.classPosition}/${row.classSize}`,
            class_size: row.classSize,
            remark: row.overall.remark ?? '',
          },
        };
      });
      break;
    }
    default:
      throw ApiError.badRequest('Unknown target group');
  }

  if (needsFees && target.type !== 'defaulters') {
    recipients = await withFeeContext(recipients, await resolveTermId(target.termId, true));
  }

  // One SMS per phone unless the text is personalised per student.
  const personalised = used.some((key) => !['school'].includes(key));
  if (!personalised) {
    const seen = new Set();
    recipients = recipients.filter((recipient) => {
      const key = normalizeTzPhone(recipient.phone) || recipient.phone;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw ApiError.badRequest(`A single broadcast is limited to ${MAX_RECIPIENTS} recipients; narrow the audience`);
  }
  return recipients.map((recipient) => ({ ...recipient, message: render(message, recipient.context) }));
}

function summarizeRecipients(recipients, target) {
  let totalSegments = 0;
  let maxSegments = 0;
  let encoding = 'GSM-7';
  let invalid = 0;
  for (const recipient of recipients) {
    const info = analyzeSms(recipient.message);
    if (!normalizeTzPhone(recipient.phone)) {
      invalid += 1;
      continue;
    }
    totalSegments += info.segments;
    maxSegments = Math.max(maxSegments, info.segments);
    if (info.encoding === 'UCS-2') encoding = 'UCS-2';
  }
  return {
    recipients: recipients.length - invalid,
    invalidPhones: invalid,
    totalSegments,
    maxSegments,
    encoding,
    samples: recipients.slice(0, 3).map((recipient) => ({ phone: normalizeTzPhone(recipient.phone) || recipient.phone, message: recipient.message })),
    allowedPlaceholders: PLACEHOLDERS[target.type],
    configured: smsService.isSmsConfigured(),
  };
}

export async function previewBroadcast({ target, message }, user) {
  return summarizeRecipients(await resolveRecipients(target, message, user), target);
}

export async function sendBroadcast({ target, message, category }, user, context) {
  const recipients = await resolveRecipients(target, message, user);
  const preview = summarizeRecipients(recipients, target);
  if (preview.maxSegments > MAX_SEGMENTS) {
    throw ApiError.badRequest(`Messages may not exceed ${MAX_SEGMENTS} SMS parts; shorten the text`, { message: 'Too long' });
  }
  if (preview.recipients === 0) throw ApiError.badRequest('No recipients with a valid phone number match this audience');

  const summary = await smsService.sendBulkSMS({
    messages: recipients.map((recipient) => ({ recipient: recipient.phone, message: recipient.message, studentId: recipient.studentId })),
    category: category ?? DEFAULT_CATEGORY[target.type],
    sentBy: user.id,
    background: true,
  });
  await recordAudit({
    ...context,
    action: 'sms.broadcast',
    targetTable: 'sms_logs',
    details: { batchId: summary.batchId, target, template: message, recipients: summary.total, segments: preview.totalSegments },
  });
  return { ...summary, estimatedSegments: preview.totalSegments, configured: preview.configured };
}

const LOG_SELECT = `SELECT l.id, l.batch_id AS batchId, l.recipient, l.message, l.segments, l.category, l.status,
    l.provider_request_id AS providerRequestId, l.error_message AS errorMessage, l.retry_of AS retryOf,
    l.sent_at AS sentAt, l.created_at AS createdAt, l.student_id AS studentId,
    s.first_name AS studentFirstName, s.last_name AS studentLastName, s.registration_number AS registrationNumber,
    u.full_name AS sentByName
  FROM sms_logs l
  LEFT JOIN students s ON s.id = l.student_id
  LEFT JOIN users u ON u.id = l.sent_by`;

export async function listLogs(filters, pagination) {
  const where = [];
  const params = [];
  const add = (sql, ...values) => {
    where.push(sql);
    params.push(...values);
  };
  if (filters.status) add('l.status = ?', filters.status);
  if (filters.category) add('l.category = ?', filters.category);
  if (filters.batchId) add('l.batch_id = ?', filters.batchId);
  if (filters.dateFrom) add('l.created_at >= ?', `${filters.dateFrom} 00:00:00`);
  if (filters.dateTo) add('l.created_at <= ?', `${filters.dateTo} 23:59:59`);
  if (filters.search) {
    const term = likeContains(filters.search);
    add("(l.recipient LIKE ? OR l.message LIKE ? OR s.registration_number LIKE ? OR CONCAT_WS(' ', s.first_name, s.last_name) LIKE ?)",
      term, term, term, term);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const fromSql = `FROM sms_logs l LEFT JOIN students s ON s.id = l.student_id ${whereSql}`;
  const [{ total }, rows, statusRows] = await Promise.all([
    queryOne(`SELECT COUNT(*) AS total ${fromSql}`, params),
    query(`${LOG_SELECT} ${whereSql} ORDER BY l.id DESC LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`, params),
    query(`SELECT l.status, COUNT(*) AS total, SUM(l.segments) AS segments ${fromSql} GROUP BY l.status`, params),
  ]);
  return {
    ...paginated(rows.map((row) => ({
      ...row,
      studentName: row.studentFirstName ? `${row.studentFirstName} ${row.studentLastName}` : null,
    })), total, pagination),
    statusCounts: Object.fromEntries(statusRows.map((row) => [row.status, { total: row.total, segments: Number(row.segments) }])),
  };
}

export async function retry(ids, user, context) {
  const result = await smsService.retryFailedMessages(ids, user.id);
  if (result.queued) {
    await recordAudit({ ...context, action: 'sms.retry', targetTable: 'sms_logs', details: { ids, queued: result.queued, batchId: result.batchId } });
  }
  return result;
}

export async function balance() {
  return smsService.getBeemBalance();
}
