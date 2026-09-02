import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { getPgMem } from './pgmem';

dotenv.config();

// DB_DRIVER=postgres uses a real PostgreSQL connection.
// Defaults to in-memory emulation (pg-mem) for standalone container/preview runtime.
const usePgMem = process.env.DB_DRIVER !== 'postgres';

const pool: Pool = usePgMem
  ? (getPgMem().pool as unknown as Pool)
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'kavach',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false }
        : undefined,
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