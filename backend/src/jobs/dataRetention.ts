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
  screenTime: days('RETENTION_SCREEN_TIME_DAYS', 30),
  audit: days('RETENTION_AUDIT_DAYS', 730),
};

export const purgeLocationLogs = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  
  while (true) {
    const result = await query(
      `DELETE FROM location_logs WHERE id IN (
        SELECT id FROM location_logs 
        WHERE recorded_at < now() - ($1 || ' days')::interval 
        LIMIT $2
      )`,
      [String(RETENTION_DAYS.location), batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  
  return totalDeleted;
};

export const purgeScreenTimeLogs = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  
  while (true) {
    const result = await query(
      `DELETE FROM screen_time_logs WHERE id IN (
        SELECT id FROM screen_time_logs 
        WHERE date_recorded < CURRENT_DATE - $1::int 
        LIMIT $2
      )`,
      [RETENTION_DAYS.screenTime, batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  
  return totalDeleted;
};

export const purgeAuditLogs = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  
  while (true) {
    const result = await query(
      `DELETE FROM audit_logs WHERE id IN (
        SELECT id FROM audit_logs 
        WHERE created_at < now() - ($1 || ' days')::interval 
        LIMIT $2
      )`,
      [String(RETENTION_DAYS.audit), batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  
  return totalDeleted;
};

export const purgeCommunicationLogs = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  while (true) {
    const result = await query(
      `DELETE FROM communication_logs WHERE id IN (
        SELECT id FROM communication_logs 
        WHERE recorded_at < now() - interval '90 days'
        LIMIT $1
      )`,
      [batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  return totalDeleted;
};

export const purgeMoodLogs = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  while (true) {
    const result = await query(
      `DELETE FROM mood_logs WHERE id IN (
        SELECT id FROM mood_logs 
        WHERE created_at < now() - interval '365 days'
        LIMIT $1
      )`,
      [batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  return totalDeleted;
};

export const purgeDeviceHealthLogs = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  while (true) {
    const result = await query(
      `DELETE FROM device_health_logs WHERE id IN (
        SELECT id FROM device_health_logs 
        WHERE created_at < now() - interval '90 days'
        LIMIT $1
      )`,
      [batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  return totalDeleted;
};

export const purgeKeywordAlerts = async (): Promise<number> => {
  let totalDeleted = 0;
  const batchSize = 10000;
  while (true) {
    const result = await query(
      `DELETE FROM keyword_alerts WHERE id IN (
        SELECT id FROM keyword_alerts 
        WHERE created_at < now() - interval '90 days'
        LIMIT $1
      )`,
      [batchSize]
    );
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }
  return totalDeleted;
};

export const runAllRetentionPurges = async (): Promise<void> => {
  try {
    const [loc, st, audit, comm, mood, health, keywords] = await Promise.all([
      purgeLocationLogs(),
      purgeScreenTimeLogs(),
      purgeAuditLogs(),
      purgeCommunicationLogs(),
      purgeMoodLogs(),
      purgeDeviceHealthLogs(),
      purgeKeywordAlerts(),
    ]);
    logger.info(
      `Retention purge complete: ${loc} location, ${st} screen-time, ${audit} audit, ${comm} communication, ${mood} mood, ${health} device-health, ${keywords} keyword-alert rows deleted`
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
