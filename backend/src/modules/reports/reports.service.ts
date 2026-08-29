// reports.service.ts
// Business logic for report endpoints. Aggregates data from various
// tables to generate safety, location, usage, and communication reports.

import { query } from '../../config/database';
import { verifyChildBelongsToParent } from '../children/children.service';

/**
 * Get date range based on period.
 */
const getDateRange = (period: 'week' | 'month') => {
  const rangeDays = period === 'month' ? 30 : 7;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - rangeDays);
  return {
    start: periodStart.toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
    days: rangeDays,
  };
};

/**
 * Safety report: safety score breakdown, alerts count, restrictions compliance.
 */
export const getSafetyReport = async (
  parentId: string,
  childId: string,
  period: 'week' | 'month'
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const range = getDateRange(period);

  const [keywordAlerts, selfHarmAlerts, sosEvents, securityAlerts, blockedApps, screenTimeViolations] = await Promise.all([
    query(
      `SELECT severity, COUNT(*)::int AS count
       FROM keyword_alerts
       WHERE created_at >= $1::date AND child_id = $2
       GROUP BY severity`,
      [range.start, childId]
    ),
    query(
      `SELECT risk_level, COUNT(*)::int AS count
       FROM self_harm_alerts
       WHERE created_at >= $1::date AND child_id = $2
       GROUP BY risk_level`,
      [range.start, childId]
    ),
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM emergency_sos_events
       WHERE created_at >= $1::date AND child_id = $2
       GROUP BY status`,
      [range.start, childId]
    ),
    query(
      `SELECT threats_found > 0 AS has_threats, COUNT(*)::int AS count
       FROM security_scans ss
       JOIN devices d ON d.id = ss.device_id
       WHERE ss.scanned_at >= $1::date AND d.child_id = $2
       GROUP BY threats_found > 0`,
      [range.start, childId]
    ),
    query(
      `SELECT COUNT(*)::int AS total_blocked
       FROM app_block_rules abr
       JOIN devices d ON d.id = abr.device_id
       WHERE d.child_id = $1 AND abr.is_blocked = true`,
      [childId]
    ),
    query(
      `SELECT COUNT(*)::int AS violations
       FROM screen_time_logs stl
       JOIN devices d ON d.id = stl.device_id
       WHERE d.child_id = $2
         AND stl.date_recorded >= $1::date
         AND EXISTS (
           SELECT 1 FROM children c
           WHERE c.id = $2
             AND c.daily_screen_time_limit_minutes IS NOT NULL
             AND stl.seconds > c.daily_screen_time_limit_minutes * 60
         )`,
      [range.start, childId]
    ),
  ]);

  return {
    period: { start: range.start, end: range.end, type: period },
    keyword_alerts: keywordAlerts.rows,
    self_harm_alerts: selfHarmAlerts.rows,
    sos_events: sosEvents.rows,
    security_alerts: securityAlerts.rows,
    app_blocking: blockedApps.rows[0],
    screen_time_violations: screenTimeViolations.rows[0],
  };
};

/**
 * Location report: places visited, time spent, travel patterns.
 */
export const getLocationReport = async (
  parentId: string,
  childId: string,
  period: 'week' | 'month'
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const range = getDateRange(period);

  const [totalPings, dailyActivity, geofenceEvents, activeGeofences] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total_pings
       FROM location_logs ll
       JOIN devices d ON d.id = ll.device_id
       WHERE ll.recorded_at >= $1::date AND d.child_id = $2`,
      [range.start, childId]
    ),
    query(
      `SELECT DATE(ll.recorded_at) AS date, COUNT(*)::int AS pings
       FROM location_logs ll
       JOIN devices d ON d.id = ll.device_id
       WHERE ll.recorded_at >= $1::date AND d.child_id = $2
       GROUP BY DATE(ll.recorded_at)
       ORDER BY date ASC`,
      [range.start, childId]
    ),
    query(
      `SELECT geofence_id, event_type, COUNT(*)::int AS count
       FROM geofence_events ge
       JOIN devices d ON d.id = ge.device_id
       WHERE ge.created_at >= $1::date AND d.child_id = $2
       GROUP BY geofence_id, event_type`,
      [range.start, childId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM geofences
       WHERE child_id = $1 AND is_active = true`,
      [childId]
    ),
  ]);

  return {
    period: { start: range.start, end: range.end, type: period },
    total_pings: totalPings.rows[0]?.total_pings ?? 0,
    daily_activity: dailyActivity.rows,
    geofence_events: geofenceEvents.rows,
    active_geofences: activeGeofences.rows[0]?.count ?? 0,
  };
};

/**
 * Usage report: top apps, screen time, daily breakdown.
 */
export const getUsageReport = async (
  parentId: string,
  childId: string,
  period: 'week' | 'month'
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const range = getDateRange(period);

  const [dailyTotals, topApps, categoryBreakdown] = await Promise.all([
    query(
      `SELECT date_recorded, SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY date_recorded
       ORDER BY date_recorded ASC`,
      [range.start, childId]
    ),
    query(
      `SELECT app_package, app_category, SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY app_package, app_category
       ORDER BY total_seconds DESC
       LIMIT 10`,
      [range.start, childId]
    ),
    query(
      `SELECT COALESCE(app_category, 'unknown') AS category, SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY app_category
       ORDER BY total_seconds DESC`,
      [range.start, childId]
    ),
  ]);

  // Grand total
  const grandTotal = dailyTotals.rows.reduce(
    (acc: number, r: { total_seconds: number }) => acc + r.total_seconds,
    0
  );

  return {
    period: { start: range.start, end: range.end, type: period },
    screen_time: {
      daily_totals: dailyTotals.rows,
      top_apps: topApps.rows,
      by_category: categoryBreakdown.rows,
      grand_total_seconds: grandTotal,
    },
  };
};

/**
 * Communication report: calls made/received, SMS count, contacts.
 */
export const getCommunicationReport = async (
  parentId: string,
  childId: string,
  period: 'week' | 'month'
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const range = getDateRange(period);

  const [commStats, dailyVolume, topContacts, flaggedCount] = await Promise.all([
    query(
      `SELECT comm_type, COUNT(*)::int AS count,
              SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END)::int AS flagged,
              SUM(COALESCE(duration_seconds, 0))::int AS total_duration_seconds
       FROM communication_logs
       WHERE recorded_at >= $1::date
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY comm_type`,
      [range.start, childId]
    ),
    query(
      `SELECT DATE(recorded_at) AS date, comm_type, COUNT(*)::int AS count
       FROM communication_logs
       WHERE recorded_at >= $1::date
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY DATE(recorded_at), comm_type
       ORDER BY date ASC`,
      [range.start, childId]
    ),
    query(
      `SELECT contact_number, contact_name, COUNT(*)::int AS interactions
       FROM communication_logs
       WHERE recorded_at >= $1::date
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
         AND contact_number IS NOT NULL
       GROUP BY contact_number, contact_name
       ORDER BY interactions DESC
       LIMIT 10`,
      [range.start, childId]
    ),
    query(
      `SELECT COUNT(*)::int AS flagged_count
       FROM communication_logs
       WHERE recorded_at >= $1::date
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
         AND is_flagged = true`,
      [range.start, childId]
    ),
  ]);

  return {
    period: { start: range.start, end: range.end, type: period },
    communication_stats: commStats.rows,
    daily_volume: dailyVolume.rows,
    top_contacts: topContacts.rows,
    flagged_count: flaggedCount.rows[0]?.flagged_count ?? 0,
  };
};
