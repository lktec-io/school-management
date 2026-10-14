import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../config/env.js';

const configDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../config');
const schemaPath = path.join(configDir, 'schema.sql');
const migrationsDir = path.join(configDir, 'migrations');

/**
 * 1. Applies the idempotent baseline schema (schema.sql).
 * 2. Applies each pending file in config/migrations/ in filename order, recording it in
 *    schema_migrations so it never runs twice.
 */
async function migrate() {
  if (!/^[A-Za-z0-9_]+$/.test(env.db.name)) {
    throw new Error('DB_NAME may only contain letters, numbers and underscores');
  }

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${env.db.name}\``);

    await connection.query(await readFile(schemaPath, 'utf8'));
    console.log('Baseline schema applied.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(100) NOT NULL,
        applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [appliedRows] = await connection.query('SELECT version FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.version));
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;
      console.log(`Applying migration ${version} ...`);
      await connection.query(await readFile(path.join(migrationsDir, file), 'utf8'));
      await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
      count += 1;
    }
    console.log(count === 0 ? 'No pending migrations.' : `${count} migration(s) applied.`);

    const [tables] = await connection.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
      [env.db.name],
    );
    console.log(`Database "${env.db.name}" has ${tables.length} tables.`);
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
