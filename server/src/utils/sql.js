import { ApiError } from '../middleware/errorHandler.js';

/** "?, ?, ?" for an IN (...) list of the given length (execute() cannot expand arrays). */
export function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Escape LIKE wildcards in user input and wrap it for a contains-search. */
export function likeContains(term) {
  return `%${String(term).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Convert MySQL TINYINT(1) columns to real booleans on each row. */
export function withBooleans(rows, fields) {
  const convert = (row) => {
    const copy = { ...row };
    for (const field of fields) {
      if (copy[field] !== undefined && copy[field] !== null) copy[field] = Number(copy[field]) === 1;
    }
    return copy;
  };
  return Array.isArray(rows) ? rows.map(convert) : rows && convert(rows);
}

/** Convert DECIMAL strings (mysql2 returns them as strings) to numbers on each row. */
export function withNumbers(rows, fields) {
  const convert = (row) => {
    const copy = { ...row };
    for (const field of fields) {
      if (copy[field] !== undefined && copy[field] !== null) copy[field] = Number(copy[field]);
    }
    return copy;
  };
  return Array.isArray(rows) ? rows.map(convert) : rows && convert(rows);
}

/**
 * Build the SET clause for a partial UPDATE from validated data.
 * `columnMap` maps API field names to column names; only fields present in `data` are included.
 */
export function buildUpdateSet(data, columnMap) {
  const sets = [];
  const params = [];
  for (const [field, column] of Object.entries(columnMap)) {
    if (data[field] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(typeof data[field] === 'boolean' ? Number(data[field]) : data[field]);
  }
  return { sets, params };
}

/** Re-throw a MySQL duplicate-key error as a 409 with a domain-specific message. */
export function rethrowDuplicate(error, message, details) {
  if (error?.code === 'ER_DUP_ENTRY') throw ApiError.conflict(message, details);
  throw error;
}

export function round(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}
