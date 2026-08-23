// migrate.ts
// Run all SQL migrations in order with tracking to prevent re-application.
// Usage: npx ts-node src/jobs/migrate.ts
// Or: npm run db:migrate (after adding the script to package.json)

import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import logger from '../utils/logger';

const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

export const runMigrations = async (): Promise<void> => {
  // Create migrations tracking table if it doesn't exist
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Get already applied migrations
  const applied = await query(`SELECT filename FROM schema_migrations`);
  const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));

  let appliedCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.info(`Skipping already applied migration: ${file}`);
      continue;
    }
    
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    logger.info(`Running migration: ${file}`);
    await query(sql);
    await query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
    logger.info(`Migration complete: ${file}`);
    appliedCount++;
  }

  logger.info(`Migration complete: ${appliedCount} new migrations applied (${files.length - appliedCount} already applied)`);
};

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
