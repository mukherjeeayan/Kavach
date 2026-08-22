// screentime.service.ts
// Per-app usage aggregation. The Android app records usage events
// locally and uploads them in batches; parents read daily breakdowns
// and day/week/month summaries.

import pool, { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { getLimitRulesForDevice } from '../appblocking/appBlockRule.repository';

export interface ScreenTimeEntry {
  app_package: string;
  app_category?: string;
  seconds: number;
  date?: string;
}

/**
 * Batch-upload usage entries for a device the parent owns.
 * Idempotent by design: repeated uploads accumulate seconds.
 *
 * After persisting, the child's daily screen-time limit is evaluated
 * server-side (the device is never trusted with the limit). When the
 * day's total crosses the limit for the first time, a
 * SCREEN_TIME_LIMIT_REACHED alert is written to the audit log — the
 * parent portal surfaces it under /children/:childId/alerts.
 */
export const recordScreenTime = async (
  parentId: string,
  deviceId: string,
  entries: ScreenTimeEntry[],
  batchId?: string
): Promise<{ duplicate: boolean }> => {
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) {
    throw new NotFoundError('Device not found for this parent');
  }
  // All entries are applied atomically — a partial batch must never
  // leave the daily totals half-updated. When the device supplies a
  // batch_id, a retry of an already-processed batch is a no-op (the
  // INSERT ... ON CONFLICT DO NOTHING claims the id atomically).
  const client = await pool.connect();
  let duplicate = false;
  try {
    await client.query('BEGIN');

    if (batchId) {
      const claimed = await client.query(
        `INSERT INTO screen_time_uploads (batch_id, device_id, entries)
         VALUES ($1, $2, $3)
         ON CONFLICT (batch_id) DO NOTHING`,
        [batchId, deviceId, entries.length]
      );
      if ((claimed.rowCount ?? 0) === 0) {
        duplicate = true;
        await client.query('COMMIT');
        return { duplicate };
      }
    }

    for (const entry of entries) {
      const date = entry.date || new Date().toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO screen_time_logs (device_id, app_package, app_category, seconds, date_recorded)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (device_id, app_package, date_recorded)
         DO UPDATE SET seconds = screen_time_logs.seconds + EXCLUDED.seconds,
                       app_category = COALESCE(EXCLUDED.app_category, screen_time_logs.app_category)`,
        [deviceId, entry.app_package, entry.app_category || null, entry.seconds, date]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (!duplicate) {
    await writeAuditLog({
      actorId: parentId,
      targetChildId: device.rows[0].child_id,
      action: 'UPLOAD_SCREEN_TIME',
      resourceType: 'screen_time_logs',
      details: { device_id: deviceId, entries: entries.length },
    });

    await evaluateDailyLimit(parentId, device.rows[0].child_id);
    await evaluatePerAppLimits(parentId, device.rows[0].child_id, deviceId, entries);
  }

  return { duplicate };
};

/**
 * Per-app usage caps: one PER_APP_LIMIT_REACHED alert per rule per
 * day — no spam on every upload after the cap is crossed.
 */
const evaluatePerAppLimits = async (
  parentId: string,
  childId: string,
  deviceId: string,
  entries: ScreenTimeEntry[]
): Promise<void> => {
  const cappedRules = await getLimitRulesForDevice(deviceId);
  if (cappedRules.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const touchedPackages = new Set(entries.map((e) => e.app_package));
  const relevant = cappedRules.filter((r) => touchedPackages.has(r.package_name));
  if (relevant.length === 0) return;

  // Use the same UTC day boundary as the upload default so limit
  // evaluation and alert dedup can never disagree about "today".
  const todayTotal = await query(
    `SELECT app_package, COALESCE(SUM(seconds), 0)::int AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded = $2 AND device_id = $1
     GROUP BY app_package`,
    [deviceId, today]
  );
  const totals = new Map(
    todayTotal.rows.map((r: { app_package: string; total_seconds: number }) => [
      r.app_package,
      Number(r.total_seconds),
    ])
  );

  for (const rule of relevant) {
    const used = totals.get(rule.package_name) ?? 0;
    if (used <= rule.daily_limit_minutes * 60) continue;

    const existing = await query(
      `SELECT 1 FROM audit_logs
       WHERE target_child_id = $1
         AND action = 'PER_APP_LIMIT_REACHED'
         AND details->>'rule_id' = $2
         AND details->>'date' = $3
       LIMIT 1`,
      [childId, rule.id, today]
    );
    if (existing.rows.length > 0) continue;

    await writeAuditLog({
      actorId: parentId,
      targetChildId: childId,
      action: 'PER_APP_LIMIT_REACHED',
      resourceType: 'app_block_rules',
      details: {
        rule_id: rule.id,
        package_name: rule.package_name,
        date: today,
        used_minutes: Math.round(used / 60),
        limit_minutes: rule.daily_limit_minutes,
      },
    });
  }
};

/**
 * One alert per child per day per limit breach — no spam on every
 * upload after the limit is crossed.
 */
const evaluateDailyLimit = async (parentId: string, childId: string): Promise<void> => {
  const child = await query(
    `SELECT daily_screen_time_limit_minutes FROM children WHERE id = $1`,
    [childId]
  );
  const limitMinutes = child.rows[0]?.daily_screen_time_limit_minutes;
  if (limitMinutes == null) return;

  const today = new Date().toISOString().slice(0, 10);

  const todayTotal = await query(
    `SELECT COALESCE(SUM(seconds), 0)::int AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded = $2
       AND device_id IN (SELECT id FROM devices WHERE child_id = $1)`,
    [childId, today]
  );
  const totalSeconds = Number(todayTotal.rows[0]?.total_seconds ?? 0);
  if (totalSeconds <= limitMinutes * 60) return;

  const existing = await query(
    `SELECT 1 FROM audit_logs
     WHERE target_child_id = $1
       AND action = 'SCREEN_TIME_LIMIT_REACHED'
       AND details->>'date' = $2
     LIMIT 1`,
    [childId, today]
  );
  if (existing.rows.length > 0) return;

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SCREEN_TIME_LIMIT_REACHED',
    resourceType: 'screen_time_logs',
    details: {
      date: today,
      total_minutes: Math.round(totalSeconds / 60),
      limit_minutes: limitMinutes,
    },
  });
};

/**
 * Per-app usage for a single date (defaults to today), across all of
 * the child's devices.
 */
export const getDailyScreenTime = async (
  parentId: string,
  childId: string,
  date: string
): Promise<Array<Record<string, unknown>>> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `SELECT device_id, app_package, app_category, SUM(seconds) AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded = $1
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY device_id, app_package, app_category
     ORDER BY total_seconds DESC`,
    [date, childId]
  );
  return result.rows;
};

/**
 * Summary for the last 1 / 7 / 30 days: grand total, per-day totals,
 * and per-app totals.
 */
export const getScreenTimeSummary = async (
  parentId: string,
  childId: string,
  range: 'day' | 'week' | 'month'
): Promise<Record<string, unknown>> => {
  await verifyChildBelongsToParent(childId, parentId);
  const rangeDays = range === 'month' ? 30 : range === 'week' ? 7 : 1;

  const daily = await query(
    `SELECT date_recorded, SUM(seconds) AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded >= (CURRENT_DATE - $1::int)
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY date_recorded
     ORDER BY date_recorded ASC`,
    [rangeDays, childId]
  );

  const byApp = await query(
    `SELECT app_package, COALESCE(app_category, 'unknown') AS app_category,
            SUM(seconds) AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded >= (CURRENT_DATE - $1::int)
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY app_package, app_category
     ORDER BY total_seconds DESC`,
    [rangeDays, childId]
  );

  const totalSeconds = daily.rows.reduce(
    (acc: number, row: { total_seconds: string | null }) =>
      acc + Number(row.total_seconds ?? 0),
    0
  );

  return {
    range,
    total_seconds: totalSeconds,
    daily: daily.rows,
    by_app: byApp.rows,
  };
};
