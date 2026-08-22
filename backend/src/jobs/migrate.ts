// migrate.ts
// Run all SQL migrations in order.
// Usage: npx ts-node src/jobs/migrate.ts
// Or: npm run db:migrate (after adding the script to package.json)

import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import logger from '../utils/logger';

const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

export const runMigrations = async (): Promise<void> => {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    logger.info(`Running migration: ${file}`);
    await query(sql);
    logger.info(`Migration complete: ${file}`);
  }

  logger.info(`All ${files.length} migrations applied successfully`);
};

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
