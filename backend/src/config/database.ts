import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { getPgMem } from './pgmem';

dotenv.config();

// DB_DRIVER=pg-mem swaps the real PostgreSQL connection for an
// in-memory emulation (used by the e2e suite on machines without
// Docker/Postgres). The same pg-mem pool is returned to the test
// bootstrap so migrations and queries run against one database.
const pool: Pool =
  process.env.DB_DRIVER === 'pg-mem'
    ? getPgMem().pool
    : new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

pool.on('error', (err) => {
  // A transient idle-client error must not kill the whole process —
  // pg can recover and re-establish connections on demand.
  logger.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

export default pool;