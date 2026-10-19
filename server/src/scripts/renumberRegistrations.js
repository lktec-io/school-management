/**
 * Change the prefix of existing registration numbers, e.g. ZNZ/2026/001 → S1819/2026/001.
 * New students already use REG_NUMBER_PREFIX; this converts records created before it changed.
 *
 *   npm run reg:renumber -- --from ZNZ                 # preview only (default)
 *   npm run reg:renumber -- --from ZNZ --apply         # write the changes
 *   npm run reg:renumber -- --from ZNZ --to S1819 --apply
 *
 * --to defaults to REG_NUMBER_PREFIX. Year and sequence are kept; the change is recorded in the
 * audit log. Reports and receipts printed earlier keep the old number on paper.
 */
import env from '../config/env.js';
import { closePool, query, withTransaction } from '../config/db.js';
import { recordAudit } from '../utils/audit.js';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const from = argument('from');
const to = argument('to') ?? env.school.regNumberPrefix;
const apply = process.argv.includes('--apply');
const PREFIX = /^[A-Za-z0-9-]{1,20}$/;

if (!from || !PREFIX.test(from) || !PREFIX.test(to)) {
  console.error('Usage: npm run reg:renumber -- --from OLDPREFIX [--to NEWPREFIX] [--apply]');
  process.exit(1);
}
if (from === to) {
  console.error(`Nothing to do: --from and --to are both "${to}".`);
  process.exit(1);
}

const rows = await query(
  'SELECT id, registration_number AS regNo FROM students WHERE registration_number LIKE ? ORDER BY registration_number',
  [`${from}/%`],
);
const changes = rows.map((row) => ({ id: row.id, before: row.regNo, after: `${to}${row.regNo.slice(from.length)}` }));
const clashes = changes.length
  ? await query(
    `SELECT registration_number AS regNo FROM students WHERE registration_number IN (${changes.map(() => '?').join(', ')})`,
    changes.map((change) => change.after),
  )
  : [];

console.log(`${changes.length} student record(s) use the "${from}/" prefix; new prefix "${to}/".`);
for (const change of changes.slice(0, 10)) console.log(`  ${change.before}  →  ${change.after}`);
if (changes.length > 10) console.log(`  … and ${changes.length - 10} more`);

if (clashes.length) {
  console.error(`\nStopped: ${clashes.length} target number(s) already exist (e.g. ${clashes[0].regNo}). Nothing was changed.`);
  await closePool();
  process.exit(1);
}
if (!apply) {
  console.log('\nPreview only — run again with --apply to update these records.');
  await closePool();
  process.exit(0);
}

await withTransaction(async (connection) => {
  for (const change of changes) {
    await query('UPDATE students SET registration_number = ? WHERE id = ?', [change.after, change.id], connection);
  }
  await recordAudit({
    action: 'student.registration_prefix_change',
    targetTable: 'students',
    details: { from, to, count: changes.length, sample: changes.slice(0, 20) },
  }, connection);
});
console.log(`\nUpdated ${changes.length} registration number(s).`);
await closePool();
