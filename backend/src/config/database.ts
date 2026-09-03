import { Pool, QueryResult } from 'pg';
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
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
            ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
          }
        : undefined,
    });

pool.on('error', (err) => {
  // A transient idle-client error must not kill the whole process —
  // pg can recover and re-establish connections on demand.
  logger.error('Unexpected error on idle client', err);
});

// SECURITY: Typed query wrapper — params use a permissive but auditable type instead of raw `any[]`.
// `unknown` is accepted to allow spread operators and intermediate arrays; the pg driver
// handles serialization. This is safer than `any[]` because it forces explicit narrowing
// at the call site if a value needs inspection.
type QueryParam = string | number | boolean | null | undefined | string[] | number[] | Buffer | Date | Record<string, unknown> | unknown;

export const query = async <T extends Record<string, any> = Record<string, any>>(
  text: string,
  params?: QueryParam[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  // SECURITY: Only log query structure, not parameter values
  logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  return res;
};

export default pool;