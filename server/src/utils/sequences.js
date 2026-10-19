import { query, queryOne } from '../config/db.js';

/**
 * Return the next value of a named counter. MUST be called with a transaction connection:
 * the row lock is held until commit, so concurrent callers get distinct, gap-free values.
 */
export async function nextSequenceValue(connection, key) {
  await query(
    'INSERT INTO document_sequences (seq_key, seq_value) VALUES (?, 0) ON DUPLICATE KEY UPDATE seq_key = seq_key',
    [key],
    connection,
  );
  const row = await queryOne('SELECT seq_value FROM document_sequences WHERE seq_key = ? FOR UPDATE', [key], connection);
  const next = row.seq_value + 1;
  await query('UPDATE document_sequences SET seq_value = ? WHERE seq_key = ?', [next, key], connection);
  return next;
}

/** The value nextSequenceValue() would return now, without reserving it (for previews only). */
export async function peekSequenceValue(key) {
  const row = await queryOne('SELECT seq_value FROM document_sequences WHERE seq_key = ?', [key]);
  return (row?.seq_value ?? 0) + 1;
}
