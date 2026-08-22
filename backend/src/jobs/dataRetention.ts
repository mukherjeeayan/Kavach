// dataRetention.ts
// DPDP data-retention purges. Location pings, screen-time rows, and
// audit logs grow unboundedly without these; retention windows are
// configurable via env (days).
//
// Run standalone: npx ts-node src/jobs/dataRetention.ts
// The server also schedules these in-process (see jobs/scheduler.ts).

import { query } from '../config/database';
import logger from '../utils/logger';

const days = (key: string, fallback: number): number => {
  const v = parseInt(process.env[key] || String(fallback), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const RETENTION_DAYS = {
  location: days('RETENTION_LOCATION_DAYS', 90),
  screenTime: days('RETENTION_SCREEN_TIME_DAYS', 365),
  audit: days('RETENTION_AUDIT_DAYS', 730),
};

export const purgeLocationLogs = async (): Promise<number> => {
  const result = await query(
    `DELETE FROM location_logs WHERE recorded_at < now() - ($1 || ' days')::interval`,
    [String(RETENTION_DAYS.location)]
  );
  return (result as any).rowCount ?? 0;
};

export const purgeScreenTimeLogs = async (): Promise<number> => {
  const result = await query(
    `DELETE FROM screen_time_logs WHERE date_recorded < CURRENT_DATE - $1::int`,
    [RETENTION_DAYS.screenTime]
  );
  return (result as any).rowCount ?? 0;
};

export const purgeAuditLogs = async (): Promise<number> => {
  const result = await query(
    `DELETE FROM audit_logs WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(RETENTION_DAYS.audit)]
  );
  return (result as any).rowCount ?? 0;
};

export const runAllRetentionPurges = async (): Promise<void> => {
  try {
    const [loc, st, audit] = await Promise.all([
      purgeLocationLogs(),
      purgeScreenTimeLogs(),
      purgeAuditLogs(),
    ]);
    logger.info(
      `Retention purge complete: ${loc} location rows, ${st} screen-time rows, ${audit} audit rows deleted`
    );
  } catch (err) {
    logger.error('Retention purge failed', err);
  }
};

// When run directly (not imported), execute once and exit.
if (require.main === module) {
  runAllRetentionPurges()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
