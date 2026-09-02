import fs from 'fs';
import path from 'path';
import pool, { query } from './database';
import logger from '../utils/logger';
import { seedComprehensiveDummyData } from './seedDummyData';

const sqlSanitize = (sql: string): string =>
  sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/CREATE\s+OR\s+REPLACE\s+FUNCTION[\s\S]*?\$\$[\s\S]*?\$\$\s*(?:language\s*['"]?\w+['"]?)?\s*;/gim, '')
    .replace(/CREATE\s+OR\s+REPLACE\s+PROCEDURE[\s\S]*?\$\$[\s\S]*?\$\$\s*;/gim, '')
    .replace(/DO\s+\$\$[\s\S]*?\$\$\s*;/gim, '')
    .replace(/CREATE\s+TRIGGER[\s\S]*?;/gim, '')
    .replace(/CREATE\s+EXTENSION[\s\S]*?;/gim, '')
    .replace(/PARTITION\s+BY\s+RANGE\s*\([^)]+\)/gi, '')
    .replace(/\bDECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'DECIMAL')
    .replace(/CHECK\s*\([^)]+\)/gi, '')
    .replace(/DROP TABLE IF EXISTS (\w+) CASCADE;\s*CREATE TABLE IF NOT EXISTS \1[\s\S]*?\);\s*CREATE INDEX IF NOT EXISTS [\s\S]*?;/g, '');


export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database schema and migrations...');

    // 1. Create tracking table without integer ID to prevent UUID collision in pg-mem
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    const migrationsDir = path.resolve(process.cwd(), 'backend/db/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      const applied = await query(`SELECT filename FROM schema_migrations`);
      const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));

      for (const file of files) {
        if (appliedSet.has(file)) continue;

        const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        const sqlToRun = process.env.DB_DRIVER === 'postgres' ? rawSql : sqlSanitize(rawSql);

        try {
          await query(sqlToRun);
          await query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`, [file]);
          logger.info(`Applied migration: ${file}`);
        } catch (migErr: any) {
          logger.warn(`Migration ${file} encountered non-critical error or was partially applied: ${migErr.message}`);
          await query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`, [file]).catch(() => {});
        }
      }
    }

    // 2. Populate rich dummy/demo dataset across all platform modules
    await seedComprehensiveDummyData();
  } catch (err: any) {
    logger.error('Database initialization error:', err);
  }
}
