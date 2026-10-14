/**
 * Bootstrap the first Headmaster (admin) account.
 *
 *   npm run create-admin -- --name "Full Name" --email head@school.ac.tz --phone 0777123456
 *
 * A strong temporary password is generated and printed once; the account is flagged so the
 * password must be changed at first sign-in.
 */
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { closePool, query, queryOne } from '../config/db.js';
import { recordAudit } from '../utils/audit.js';
import { generateTemporaryPassword } from '../utils/passwords.js';
import { normalizeTzPhone } from '../utils/phone.js';

async function createAdmin() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
    },
  });

  const fullName = values.name?.trim();
  const email = values.email?.trim().toLowerCase() || null;
  const phone = values.phone ? normalizeTzPhone(values.phone) : null;

  if (!fullName) throw new Error('--name is required');
  if (!email && !values.phone) throw new Error('Provide --email and/or --phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('--email is not a valid email address');
  if (values.phone && !phone) throw new Error('--phone is not a valid Tanzanian mobile number');

  const existing = await queryOne(
    'SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)',
    [email, phone],
  );
  if (existing) throw new Error('A user with this email or phone already exists');

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, env.auth.bcryptSaltRounds);

  const result = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, status, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', 'active', 1)`,
    [fullName, email, phone, passwordHash],
  );
  await recordAudit({
    userId: null,
    action: 'user.create_admin_cli',
    targetTable: 'users',
    targetId: result.insertId,
    details: { fullName, email, phone },
  });

  console.log('Administrator account created.');
  console.log(`  User ID:            ${result.insertId}`);
  console.log(`  Sign in with:       ${email || phone}`);
  console.log(`  Temporary password: ${temporaryPassword}`);
  console.log('This password is shown only once and must be changed at first sign-in.');
}

createAdmin()
  .catch((error) => {
    console.error(`Could not create administrator: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => closePool());
