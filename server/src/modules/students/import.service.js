import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { normalizeTzPhone } from '../../utils/phone.js';
import { getSchoolProfile, registrationPrefix } from '../system/settings.service.js';
import { insertStudent } from './students.service.js';
import { validateStudent } from './students.validation.js';

/**
 * Bulk student registration from a spreadsheet. The browser reads the CSV/XLSX file into a grid of
 * cells; everything else — header matching, value clean-up, class/stream lookup, duplicate and
 * capacity checks — happens here, so the preview and the final save apply exactly the same rules.
 */

export const MAX_IMPORT_ROWS = 500;
const MAX_CELL_LENGTH = 255;

/** Template columns in order. Headers are matched loosely (case, spaces, punctuation; English or Swahili). */
export const IMPORT_COLUMNS = [
  { key: 'firstName', header: 'First Name', required: true, aliases: ['firstname', 'first', 'jinalakwanza'] },
  { key: 'middleName', header: 'Middle Name', aliases: ['middlename', 'middle', 'jinalakati'] },
  { key: 'lastName', header: 'Last Name', required: true, aliases: ['lastname', 'surname', 'last', 'jinalamwisho', 'jinalaukoo'] },
  { key: 'gender', header: 'Gender', required: true, aliases: ['gender', 'sex', 'jinsia'] },
  { key: 'dob', header: 'DOB', required: true, aliases: ['dob', 'dateofbirth', 'birthdate', 'tareheyakuzaliwa'] },
  { key: 'className', header: 'Class/Grade', required: true, aliases: ['classgrade', 'class', 'grade', 'darasa'] },
  { key: 'streamName', header: 'Stream', aliases: ['stream', 'mkondo'] },
  { key: 'parentName', header: 'Guardian Name', required: true, aliases: ['guardianname', 'parentname', 'guardian', 'jinalamzazi', 'jinalamlezi', 'mzazi', 'mlezi'] },
  { key: 'parentPhone', header: 'Guardian Phone', required: true, aliases: ['guardianphone', 'parentphone', 'phone', 'simu', 'nambayasimu', 'simuyamzazi'] },
  { key: 'parentRelationship', header: 'Relationship', aliases: ['relationship', 'relation', 'uhusiano'] },
  { key: 'address', header: 'Residence', aliases: ['residence', 'address', 'makazi', 'anwani'] },
];

/** Sample row written into the template; rows still matching it are rejected so it is never imported. */
const SAMPLE = {
  firstName: 'Asha', middleName: 'Mwanaisha', lastName: 'Juma', gender: 'F', dob: '2014-03-21',
  parentName: 'Juma Hassan Ali', parentPhone: '0777 123 456', parentRelationship: 'Baba', address: 'Mwanakwerekwe',
};
const SAMPLE_PHONE = normalizeTzPhone(SAMPLE.parentPhone);

const headerKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const lookupKey = (value) => clean(value).toLowerCase();

const GENDERS = {
  male: ['m', 'male', 'me', 'mume', 'mvulana', 'boy', 'kiume'],
  female: ['f', 'female', 'ke', 'mke', 'msichana', 'girl', 'kike'],
};

function normaliseGender(value) {
  const key = headerKey(value);
  if (!key) return '';
  return Object.keys(GENDERS).find((gender) => GENDERS[gender].includes(key)) ?? value;
}

const pad = (number) => String(number).padStart(2, '0');

/**
 * 2014-03-21, 21/03/2014, 21-03-2014, 21.03.2014 (day first, as written in Tanzania), or an Excel
 * serial day number (dates read straight from .xlsx cells). Unrecognised text is passed through so
 * the validator reports it.
 */
export function normaliseDate(value) {
  const text = clean(value);
  if (!text) return '';
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial > 7000 && serial < 60000) {
      // Excel day 1 = 1900-01-01 (with its 1900 leap-year quirk): serial 25569 = 1970-01-01.
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    }
  }
  return text;
}

/** Map header cells to column keys; unknown columns are ignored, missing required ones are an error. */
function mapHeaders(headerRow) {
  const indexByKey = {};
  headerRow.forEach((cell, index) => {
    const key = headerKey(cell);
    const column = IMPORT_COLUMNS.find((candidate) => candidate.aliases.includes(key));
    if (column && indexByKey[column.key] === undefined) indexByKey[column.key] = index;
  });
  const missing = IMPORT_COLUMNS.filter((column) => column.required && indexByKey[column.key] === undefined);
  if (missing.length) {
    throw ApiError.badRequest(
      `The file is missing these columns: ${missing.map((column) => column.header).join(', ')}. Download the template and copy your data into it.`,
      { file: 'Missing columns' },
    );
  }
  return indexByKey;
}

async function loadPlacements() {
  const classes = await query('SELECT id, class_name AS className, code FROM classes WHERE is_active = 1 ORDER BY sort_order, class_name');
  const streams = await query(
    `SELECT st.id, st.class_id AS classId, st.stream_name AS streamName, st.capacity,
            (SELECT COUNT(*) FROM students s WHERE s.stream_id = st.id AND s.status = 'active') AS occupied
       FROM streams st WHERE st.is_active = 1`,
  );
  const classByKey = new Map();
  for (const cls of classes) {
    classByKey.set(lookupKey(cls.className), cls);
    if (cls.code) classByKey.set(lookupKey(cls.code), cls);
  }
  return { classes, classByKey, streams };
}

async function existingStudentKeys() {
  const rows = await query('SELECT first_name AS firstName, last_name AS lastName, dob, registration_number AS regNo FROM students');
  return new Map(rows.map((row) => [identityKey(row), row.regNo]));
}

function identityKey({ firstName, lastName, dob }) {
  const date = dob instanceof Date ? dob.toISOString().slice(0, 10) : String(dob ?? '').slice(0, 10);
  return `${lookupKey(firstName)}|${lookupKey(lastName)}|${date}`;
}

function assertTable(table) {
  if (!Array.isArray(table) || table.length < 2 || !table.every(Array.isArray)) {
    throw ApiError.badRequest('The file has no student rows below the header row', { file: 'No data rows' });
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(`Import at most ${MAX_IMPORT_ROWS} students at a time (this file has ${table.length - 1}). Split the file and import each part.`, { file: 'Too many rows' });
  }
}

/**
 * Validate every row. Returns { columns, rows: [{ line, values, data?, errors, valid }], summary }.
 * `line` is the spreadsheet row number (header = 1) so staff can find the row in their file.
 */
export async function analyseImport(table) {
  assertTable(table);
  const indexByKey = mapHeaders(table[0]);
  const [{ classes, classByKey, streams }, existing] = await Promise.all([loadPlacements(), existingStudentKeys()]);
  const seen = new Map();
  const occupancy = new Map(streams.map((stream) => [stream.id, stream.occupied]));
  const rows = [];

  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const values = {};
    for (const column of IMPORT_COLUMNS) {
      const index = indexByKey[column.key];
      values[column.key] = index === undefined ? '' : clean(cells[index]).slice(0, MAX_CELL_LENGTH);
    }
    if (Object.values(values).every((value) => value === '')) return; // blank spreadsheet row

    const errors = {};
    const cls = values.className ? classByKey.get(lookupKey(values.className)) : null;
    if (!values.className) errors.className = 'Class is required';
    else if (!cls) errors.className = `No active class named "${values.className}". Use one of: ${classes.map((c) => c.className).join(', ')}`;

    let stream = null;
    if (cls && values.streamName) {
      stream = streams.find((candidate) => candidate.classId === cls.id && lookupKey(candidate.streamName) === lookupKey(values.streamName));
      if (!stream) {
        const options = streams.filter((candidate) => candidate.classId === cls.id).map((candidate) => candidate.streamName);
        errors.streamName = options.length
          ? `${cls.className} has no stream "${values.streamName}". Use: ${options.join(', ')}`
          : `${cls.className} has no streams — leave Stream empty`;
      }
    }

    const body = {
      firstName: values.firstName,
      middleName: values.middleName || undefined,
      lastName: values.lastName,
      gender: normaliseGender(values.gender),
      dob: normaliseDate(values.dob),
      classId: cls?.id ?? 1,
      streamId: stream?.id,
      parentName: values.parentName,
      parentPhone: values.parentPhone,
      parentRelationship: values.parentRelationship || undefined,
      address: values.address || undefined,
    };
    let data = null;
    try {
      data = validateStudent(body);
    } catch (error) {
      if (!(error instanceof ApiError) || !error.details) throw error;
      for (const [field, message] of Object.entries(error.details)) {
        if (field !== 'classId' && field !== 'streamId' && !errors[field]) errors[field] = message;
      }
    }

    if (data && !Object.keys(errors).length) {
      if (lookupKey(values.firstName) === lookupKey(SAMPLE.firstName) && lookupKey(values.lastName) === lookupKey(SAMPLE.lastName)
        && data.parentPhone === SAMPLE_PHONE) {
        errors.firstName = 'This is the sample row from the template — delete it before importing';
      } else {
        const key = identityKey(data);
        if (existing.has(key)) errors.firstName = `Already registered as ${existing.get(key)}`;
        else if (seen.has(key)) errors.firstName = `Same student as row ${seen.get(key)} in this file`;
        else seen.set(key, line);
      }
    }
    if (data && stream && !Object.keys(errors).length && stream.capacity !== null) {
      if (occupancy.get(stream.id) >= stream.capacity) errors.streamName = `${cls.className} ${stream.streamName} is full (capacity ${stream.capacity})`;
      else occupancy.set(stream.id, occupancy.get(stream.id) + 1);
    }

    const valid = Boolean(data) && Object.keys(errors).length === 0;
    rows.push({
      line,
      values,
      errors,
      valid,
      data: valid ? { ...data, classId: cls.id, streamId: stream?.id ?? null } : null,
      placement: cls ? [cls.className, stream?.streamName].filter(Boolean).join(' ') : null,
      // Cleaned-up values shown in the preview even when another column makes the row invalid.
      gender: data?.gender ?? (GENDERS[body.gender] && !errors.gender ? body.gender : null),
      dob: data?.dob ?? (/^\d{4}-\d{2}-\d{2}$/.test(body.dob) && !errors.dob ? body.dob : null),
      parentPhone: data?.parentPhone ?? (errors.parentPhone ? null : normalizeTzPhone(values.parentPhone)),
    });
  });

  if (rows.length === 0) throw ApiError.badRequest('The file has no student rows below the header row', { file: 'No data rows' });
  const validCount = rows.filter((row) => row.valid).length;
  return {
    columns: IMPORT_COLUMNS.map(({ key, header, required }) => ({ key, header, required: Boolean(required) })),
    rows: rows.map((row) => ({ ...row, data: undefined })), // validated data stays server-side
    summary: { total: rows.length, valid: validCount, invalid: rows.length - validCount },
    validRows: rows.filter((row) => row.valid),
  };
}

const COLUMN_HEADERS = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.key, column.header]));

/**
 * Rejected rows in plain words, e.g. { line: 6, reasons: ['Class/Grade — No active class named "Form Nine" …'],
 * message: 'Row 6: Class/Grade — No active class named "Form Nine" …' }.
 */
function failureReport(rows) {
  return rows.filter((row) => !row.valid).map((row) => {
    const reasons = Object.entries(row.errors).map(([field, message]) => `${COLUMN_HEADERS[field] ?? field} — ${message}`);
    const name = [row.values.firstName, row.values.lastName].filter(Boolean).join(' ') || null;
    return { line: row.line, name, reasons, message: `Row ${row.line}: ${reasons.join('; ')}` };
  });
}

/** Preview: what would be imported, with every problem listed per row. Nothing is saved. */
export async function previewImport(table) {
  const { validRows, ...result } = await analyseImport(table);
  return {
    ...result,
    nextPrefix: await registrationPrefix(),
    validLines: validRows.map((row) => row.line),
    failed: failureReport(result.rows),
  };
}

/** Save every valid row in one transaction (file order); invalid rows are skipped and reported back. */
export async function commitImport(table, context) {
  const { validRows, rows, summary } = await analyseImport(table);
  const failed = failureReport(rows);
  if (validRows.length === 0) {
    throw ApiError.badRequest(`None of the ${summary.total} row(s) can be imported. Fix the problems listed and upload the file again.`, { failed });
  }
  const prefix = await registrationPrefix();
  const created = await withTransaction(async (connection) => {
    const saved = [];
    for (const row of validRows) {
      const { id, registrationNumber } = await insertStudent(connection, row.data, { prefix, context, source: 'import' });
      saved.push({ id, line: row.line, registrationNumber, fullName: [row.data.firstName, row.data.middleName, row.data.lastName].filter(Boolean).join(' ') });
    }
    await recordAudit({
      ...context,
      action: 'student.import',
      targetTable: 'students',
      details: { imported: saved.length, skipped: summary.invalid, first: saved[0]?.registrationNumber, last: saved.at(-1)?.registrationNumber },
    }, connection);
    return saved;
  });
  // Full report — nothing is processed silently: every row is either in `created` or in `failed` with its reasons.
  return { total: summary.total, imported: created.length, skipped: failed.length, created, failed };
}

const BOM = String.fromCharCode(0xfeff);
const csvCell = (value) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** CSV template (UTF-8 with BOM so Excel shows Swahili characters) with headers and one sample row. */
export async function importTemplate() {
  const [{ classes, streams }, school] = await Promise.all([loadPlacements(), getSchoolProfile()]);
  const sampleClass = classes[0];
  const sampleStream = sampleClass ? streams.find((stream) => stream.classId === sampleClass.id) : null;
  const sample = { ...SAMPLE, className: sampleClass?.className ?? 'Form One', streamName: sampleStream?.streamName ?? '' };
  const lines = [
    IMPORT_COLUMNS.map((column) => csvCell(column.header)).join(','),
    IMPORT_COLUMNS.map((column) => csvCell(sample[column.key] ?? '')).join(','),
  ];
  const slug = String(school.name ?? 'school').split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'school';
  return { filename: `${slug}_student_import_template.csv`, content: `${BOM}${lines.join('\r\n')}\r\n` };
}
