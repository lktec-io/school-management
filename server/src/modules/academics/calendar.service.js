import { query, queryOne, withTransaction } from '../../config/db.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../utils/audit.js';
import { buildUpdateSet, rethrowDuplicate, withBooleans } from '../../utils/sql.js';

const YEAR_SELECT = `SELECT ay.id, ay.year_label AS yearLabel, ay.start_date AS startDate, ay.end_date AS endDate,
  ay.is_current AS isCurrent FROM academic_years ay`;

const TERM_SELECT = `SELECT t.id, t.academic_year_id AS academicYearId, t.term_name AS termName,
  t.term_number AS termNumber, t.start_date AS startDate, t.end_date AS endDate, t.is_current AS isCurrent
  FROM terms t`;

const YEAR_COLUMNS = { yearLabel: 'year_label', startDate: 'start_date', endDate: 'end_date' };
const TERM_COLUMNS = { termName: 'term_name', termNumber: 'term_number', startDate: 'start_date', endDate: 'end_date' };

/** The current academic year and term (either may be null until the Headmaster configures them). */
export async function getCurrentPeriod(executor) {
  const row = await queryOne(
    `SELECT ay.id AS academicYearId, ay.year_label AS yearLabel, ay.start_date AS yearStart, ay.end_date AS yearEnd,
            t.id AS termId, t.term_name AS termName, t.term_number AS termNumber,
            t.start_date AS termStart, t.end_date AS termEnd
       FROM academic_years ay
       LEFT JOIN terms t ON t.academic_year_id = ay.id AND t.is_current = 1
      WHERE ay.is_current = 1`,
    [],
    executor,
  );
  if (!row) return { academicYear: null, term: null };
  return {
    academicYear: { id: row.academicYearId, yearLabel: row.yearLabel, startDate: row.yearStart, endDate: row.yearEnd },
    term: row.termId
      ? { id: row.termId, termName: row.termName, termNumber: row.termNumber, startDate: row.termStart, endDate: row.termEnd }
      : null,
  };
}

async function findYear(id, executor) {
  const year = await queryOne(`${YEAR_SELECT} WHERE ay.id = ?`, [id], executor);
  if (!year) throw ApiError.notFound('Academic year not found');
  return withBooleans(year, ['isCurrent']);
}

async function findTerm(id, executor) {
  const term = await queryOne(`${TERM_SELECT} WHERE t.id = ?`, [id], executor);
  if (!term) throw ApiError.notFound('Term not found');
  return withBooleans(term, ['isCurrent']);
}

export async function listYears() {
  const years = withBooleans(await query(`${YEAR_SELECT} ORDER BY ay.start_date DESC`), ['isCurrent']);
  const terms = withBooleans(await query(`${TERM_SELECT} ORDER BY t.term_number`), ['isCurrent']);
  return years.map((year) => ({ ...year, terms: terms.filter((term) => term.academicYearId === year.id) }));
}

export async function createYear(data, context) {
  if (data.endDate <= data.startDate) {
    throw ApiError.badRequest('Please correct the highlighted fields', { endDate: 'End date must be after start date' });
  }
  try {
    const result = await query(
      'INSERT INTO academic_years (year_label, start_date, end_date) VALUES (?, ?, ?)',
      [data.yearLabel, data.startDate, data.endDate],
    );
    await recordAudit({ ...context, action: 'academic_year.create', targetTable: 'academic_years', targetId: result.insertId, details: data });
    return findYear(result.insertId);
  } catch (error) {
    return rethrowDuplicate(error, 'An academic year with this label already exists');
  }
}

export async function updateYear(id, data, context) {
  const existing = await findYear(id);
  const startDate = data.startDate ?? existing.startDate;
  const endDate = data.endDate ?? existing.endDate;
  if (endDate <= startDate) {
    throw ApiError.badRequest('Please correct the highlighted fields', { endDate: 'End date must be after start date' });
  }
  const outside = await queryOne(
    'SELECT COUNT(*) AS total FROM terms WHERE academic_year_id = ? AND (start_date < ? OR end_date > ?)',
    [id, startDate, endDate],
  );
  if (outside.total > 0) {
    throw ApiError.badRequest('Some terms fall outside the new dates. Adjust the terms first.');
  }

  const { sets, params } = buildUpdateSet(data, YEAR_COLUMNS);
  try {
    await query(`UPDATE academic_years SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, 'An academic year with this label already exists');
  }
  await recordAudit({ ...context, action: 'academic_year.update', targetTable: 'academic_years', targetId: id, details: { before: existing, changes: data } });
  return findYear(id);
}

export async function deleteYear(id, context) {
  const existing = await findYear(id);
  if (existing.isCurrent) throw ApiError.conflict('The current academic year cannot be deleted');
  await query('DELETE FROM academic_years WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'academic_year.delete', targetTable: 'academic_years', targetId: id, details: existing });
}

export async function setCurrentYear(id, context) {
  await findYear(id);
  await withTransaction(async (connection) => {
    // Clear first: the generated unique column allows only one current row at a time.
    await query('UPDATE academic_years SET is_current = 0 WHERE is_current = 1 AND id <> ?', [id], connection);
    await query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [id], connection);
    await query('UPDATE terms SET is_current = 0 WHERE is_current = 1 AND academic_year_id <> ?', [id], connection);
    await recordAudit({ ...context, action: 'academic_year.set_current', targetTable: 'academic_years', targetId: id }, connection);
  });
  return getCurrentPeriod();
}

function assertTermWithinYear(term, year) {
  const errors = {};
  if (term.endDate <= term.startDate) errors.endDate = 'End date must be after start date';
  if (term.startDate < year.startDate) errors.startDate = `Must be on or after the year start (${year.startDate})`;
  if (term.endDate > year.endDate) errors.endDate = `Must be on or before the year end (${year.endDate})`;
  if (Object.keys(errors).length > 0) throw ApiError.badRequest('Please correct the highlighted fields', errors);
}

export async function createTerm(data, context) {
  const year = await findYear(data.academicYearId);
  assertTermWithinYear(data, year);
  try {
    const result = await query(
      `INSERT INTO terms (academic_year_id, term_name, term_number, start_date, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      [data.academicYearId, data.termName, data.termNumber, data.startDate, data.endDate],
    );
    await recordAudit({ ...context, action: 'term.create', targetTable: 'terms', targetId: result.insertId, details: data });
    return findTerm(result.insertId);
  } catch (error) {
    return rethrowDuplicate(error, `Term ${data.termNumber} already exists for ${year.yearLabel}`);
  }
}

export async function updateTerm(id, data, context) {
  const existing = await findTerm(id);
  const year = await findYear(existing.academicYearId);
  assertTermWithinYear({ ...existing, ...data }, year);

  const { sets, params } = buildUpdateSet(data, TERM_COLUMNS);
  try {
    await query(`UPDATE terms SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (error) {
    rethrowDuplicate(error, `Term ${data.termNumber} already exists for ${year.yearLabel}`);
  }
  await recordAudit({ ...context, action: 'term.update', targetTable: 'terms', targetId: id, details: { before: existing, changes: data } });
  return findTerm(id);
}

export async function deleteTerm(id, context) {
  const existing = await findTerm(id);
  if (existing.isCurrent) throw ApiError.conflict('The current term cannot be deleted');
  await query('DELETE FROM terms WHERE id = ?', [id]);
  await recordAudit({ ...context, action: 'term.delete', targetTable: 'terms', targetId: id, details: existing });
}

/** Make a term current; its academic year becomes current too. */
export async function setCurrentTerm(id, context) {
  const term = await findTerm(id);
  await withTransaction(async (connection) => {
    await query('UPDATE academic_years SET is_current = 0 WHERE is_current = 1 AND id <> ?', [term.academicYearId], connection);
    await query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [term.academicYearId], connection);
    await query('UPDATE terms SET is_current = 0 WHERE is_current = 1 AND id <> ?', [id], connection);
    await query('UPDATE terms SET is_current = 1 WHERE id = ?', [id], connection);
    await recordAudit({ ...context, action: 'term.set_current', targetTable: 'terms', targetId: id }, connection);
  });
  return getCurrentPeriod();
}
