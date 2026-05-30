import fs from 'node:fs';
import path from 'node:path';

import { Database } from './index';

export function resolveMigrationsDir(): string {
  return path.join(__dirname, '..', 'migrations');
}

export async function runMigrations(db: Database, migrationsDir = resolveMigrationsDir()): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    const existing = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (existing.rowCount && existing.rowCount > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    applied.push(file);
  }

  return applied;
}

if (require.main === module) {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://hydrofoil:hydrofoil_dev@localhost:5432/hydrofoil';

  const db = new Database({ connectionString });
  db.connect()
    .then(() => runMigrations(db))
    .then((files) => {
      if (files.length === 0) {
        console.log('No pending migrations.');
      } else {
        console.log('Applied migrations:', files.join(', '));
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.close());
}
