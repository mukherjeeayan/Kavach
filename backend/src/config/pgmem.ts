// pgmem.ts
// In-memory PostgreSQL for environments without Docker (CI machines,
// local dev on Windows etc.). Activated with DB_DRIVER=pg-mem; the
// e2e suite uses it so the integration tests actually run everywhere
// instead of self-skipping.
//
// The pool is a singleton shared by the app (config/database.ts) and
// the e2e bootstrap, so migrations and queries hit the same database.

import { newDb, IMemoryDb, DataType } from 'pg-mem';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

interface PgMemHolder {
  db: IMemoryDb;
  pool: Pool;
}

let holder: PgMemHolder | null = null;

/**
 * pg-mem evaluates a column DEFAULT once per prepared statement and
 * reuses that value for every execution of the same SQL text. The app
 * inserts rows without an explicit id, relying on the DB default, so a
 * repeated statement (login after register, a second screen-time
 * upload, ...) would collide on the primary key.
 *
 * We sidestep this by making every INSERT that omits `id` supply one
 * explicitly: inject the column and a fresh UUID as a new bind
 * parameter. Real PostgreSQL would behave identically (explicit id
 * simply overrides the default), and the app code stays untouched.
 */
function makeIdExplicit(sql: string, values: unknown[]): { sql: string; values: unknown[] } {
  const match = sql.match(/^\s*INSERT\s+INTO\s+(\S+)\s*\(([^)]*)\)/i);
  if (!match || match.index === undefined) return { sql, values };
  const columns = match[2]
    .split(',')
    .map((c) => c.trim().toLowerCase());
  if (columns.includes('id')) return { sql, values };

  const nextParam = (values ? values.length : 0) + 1;
  const valuesIdx = sql.toUpperCase().indexOf('VALUES', match.index + match[0].length);
  if (valuesIdx === -1) return { sql, values };

  // Walk to the '(' that opens the VALUES list, then scan balanced
  // parens to its closing ')' so nested calls like to_timestamp($3)
  // are not clipped.
  let cursor = valuesIdx + 'VALUES'.length;
  while (cursor < sql.length && /\s/.test(sql[cursor])) cursor++;
  let depth = 0;
  let end = cursor;
  for (; end < sql.length; end++) {
    if (sql[end] === '(') depth++;
    else if (sql[end] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (end >= sql.length) return { sql, values };

  const withParam = `${sql.slice(0, end)}, $${nextParam}${sql.slice(end)}`;

  // Add `id` to the column list (position unchanged by the param
  // insertion, which happened later in the statement).
  const colsEnd = match.index + match[0].length;
  const withColumn =
    withParam.slice(0, colsEnd - 1) + ', id' + withParam.slice(colsEnd - 1);

  return { sql: withColumn, values: [...(values ?? []), randomUUID()] };
}

export const getPgMem = (): PgMemHolder => {
  if (holder) return holder;

  const db = newDb();
  // gen_random_uuid() is built into PostgreSQL 13+ but not pg-mem.
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
  });

  // to_timestamp(epoch) is used by the token service; pg-mem ships no
  // native implementation. Accept text or double precision args.
  db.public.registerFunction({
    name: 'to_timestamp',
    args: [DataType.text],
    returns: DataType.timestamp,
    implementation: (epochText: string) => new Date(Number(epochText) * 1000),
  });
  db.public.registerFunction({
    name: 'to_timestamp',
    args: [DataType.float],
    returns: DataType.timestamp,
    implementation: (epoch: number) => new Date(epoch * 1000),
  });

  const { Pool: MemPool } = db.adapters.createPg();
  const rawPool = new MemPool();
  const originalQuery = rawPool.query.bind(rawPool);
  rawPool.query = ((text: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
    const sql = typeof text === 'string' ? text : text.text;
    const vals = (typeof text === 'string' ? values : text.values) ?? [];
    const { sql: patched, values: patchedValues } = makeIdExplicit(sql, vals as unknown[]);
    return originalQuery(patched, patchedValues);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as typeof rawPool.query;

  holder = { db, pool: rawPool as Pool };
  return holder;
};