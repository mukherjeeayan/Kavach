// statistics.service.ts
// Pre-computed statistics for the child dashboard.

import { query } from '../../config/database';
import { verifyChildBelongsToParent } from '../children/children.service';

/**
 * Overview statistics: screen time, location pings, communication count, flagged items.
 */
export const getOverviewStats = async (
  parentId: string,
  childId: string,
  period: 'week' | 'month'
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const rangeDays = period === 'month' ? 30 : 7;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - rangeDays);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = new Date().toISOString().slice(0, 10);

  const [screenTime, locationPings, commStats, keywordAlerts] = await Promise.all([
    // Screen time totals by day
    query(
      `SELECT date_recorded, SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY date_recorded ORDER BY date_recorded ASC`,
      [periodStartStr, childId]
    ),
    // Location pings
    query(
      `SELECT COUNT(*)::int AS total_pings
       FROM location_logs ll
       JOIN devices d ON d.id = ll.device_id
       WHERE d.child_id = $1 AND ll.recorded_at::date >= $2`,
      [childId, periodStartStr]
    ),
    // Communication stats
    query(
      `SELECT comm_type, COUNT(*)::int AS count,
              SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END)::int AS flagged
       FROM communication_logs cl
       JOIN devices d ON d.id = cl.device_id
       WHERE d.child_id = $1 AND cl.recorded_at::date >= $2
       GROUP BY comm_type`,
      [childId, periodStartStr]
    ),
    // Keyword alerts by severity
    query(
      `SELECT severity, COUNT(*)::int AS count
       FROM keyword_alerts
       WHERE child_id = $1 AND created_at::date >= $2
       GROUP BY severity`,
      [childId, periodStartStr]
    ),
  ]);

  const totalScreenTime = screenTime.rows.reduce(
    (acc: number, r: { total_seconds: number }) => acc + r.total_seconds, 0
  );

  return {
    period: { type: period, start: periodStartStr, end: periodEndStr },
    screen_time: {
      daily_totals: screenTime.rows,
      grand_total_seconds: totalScreenTime,
      average_daily_seconds: screenTime.rows.length > 0
        ? Math.round(totalScreenTime / screenTime.rows.length)
        : 0,
    },
    location: { total_pings: locationPings.rows[0]?.total_pings ?? 0 },
    communications: commStats.rows,
    keyword_alerts: keywordAlerts.rows,
  };
};

/**
 * Safety score breakdown: based on flagged communications, keyword alerts, location anomalies.
 */
export const getSafetyScore = async (
  parentId: string,
  childId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const cutoff = last30Days.toISOString().slice(0, 10);

  const [flaggedComms, alertSeverity, deviceHealth] = await Promise.all([
    // Flagged communication count
    query(
      `SELECT COUNT(*)::int AS flagged_count, COUNT(*)::int AS total_count
       FROM communication_logs cl
       JOIN devices d ON d.id = cl.device_id
       WHERE d.child_id = $1 AND cl.recorded_at::date >= $2`,
      [childId, cutoff]
    ),
    // Keyword alerts by severity
    query(
      `SELECT severity, COUNT(*)::int AS count
       FROM keyword_alerts
       WHERE child_id = $1 AND created_at::date >= $2
       GROUP BY severity`,
      [childId, cutoff]
    ),
    // Device security status
    query(
      `SELECT is_rooted, is_developer_options, is_usb_debugging
       FROM device_health_logs dh
       JOIN devices d ON d.id = dh.device_id
       WHERE d.child_id = $1
       ORDER BY dh.recorded_at DESC LIMIT 1`,
      [childId]
    ),
  ]);

  const commData = flaggedComms.rows[0] || { flagged_count: 0, total_count: 0 };
  const flaggedRatio = commData.total_count > 0
    ? commData.flagged_count / commData.total_count
    : 0;

  // Calculate safety score (0-100, higher is safer)
  let score = 100;

  // Deductions for flagged communications
  if (flaggedRatio > 0.1) score -= 15;
  else if (flaggedRatio > 0.05) score -= 10;
  else if (flaggedRatio > 0.01) score -= 5;

  // Deductions for keyword alerts
  const alerts = alertSeverity.rows as Array<{ severity: string; count: number }>;
  const criticalAlerts = alerts.find((a) => a.severity === 'CRITICAL')?.count ?? 0;
  const highAlerts = alerts.find((a) => a.severity === 'HIGH')?.count ?? 0;
  const mediumAlerts = alerts.find((a) => a.severity === 'MEDIUM')?.count ?? 0;
  score -= criticalAlerts * 20;
  score -= highAlerts * 10;
  score -= mediumAlerts * 5;

  // Deductions for device security issues
  const health = deviceHealth.rows[0];
  if (health?.is_rooted) score -= 25;
  if (health?.is_developer_options) score -= 5;
  if (health?.is_usb_debugging) score -= 5;

  score = Math.max(0, Math.min(100, score));

  return {
    child_id: childId,
    score,
    breakdown: {
      flagged_communication_ratio: Math.round(flaggedRatio * 10000) / 100,
      critical_alerts: criticalAlerts,
      high_alerts: highAlerts,
      medium_alerts: mediumAlerts,
      device_rooted: health?.is_rooted ?? false,
      developer_options: health?.is_developer_options ?? false,
      usb_debugging: health?.is_usb_debugging ?? false,
    },
    period: { days: 30, start: cutoff },
  };
};

/**
 * App usage summary: top apps, total screen time, category breakdown.
 */
export const getUsageSummary = async (
  parentId: string,
  childId: string,
  period: 'week' | 'month'
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const rangeDays = period === 'month' ? 30 : 7;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - rangeDays);
  const periodStartStr = periodStart.toISOString().slice(0, 10);

  const [topApps, categoryBreakdown, dailyTotal] = await Promise.all([
    // Top apps by usage
    query(
      `SELECT app_package, COALESCE(app_category, 'unknown') AS category,
              SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY app_package, app_category
       ORDER BY total_seconds DESC
       LIMIT 10`,
      [periodStartStr, childId]
    ),
    // Category breakdown
    query(
      `SELECT COALESCE(app_category, 'unknown') AS category,
              SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY app_category
       ORDER BY total_seconds DESC`,
      [periodStartStr, childId]
    ),
    // Daily total screen time
    query(
      `SELECT date_recorded, SUM(seconds)::int AS total_seconds
       FROM screen_time_logs
       WHERE date_recorded >= $1
         AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
       GROUP BY date_recorded
       ORDER BY date_recorded ASC`,
      [periodStartStr, childId]
    ),
  ]);

  const grandTotal = dailyTotal.rows.reduce(
    (acc: number, r: { total_seconds: number }) => acc + r.total_seconds, 0
  );

  return {
    period: { type: period, start: periodStartStr },
    top_apps: topApps.rows,
    by_category: categoryBreakdown.rows,
    daily_totals: dailyTotal.rows,
    grand_total_seconds: grandTotal,
  };
};

/**
 * Restriction compliance stats: how well the child follows set restrictions.
 */
export const getRestrictionCompliance = async (
  parentId: string,
  childId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const cutoff = last30Days.toISOString().slice(0, 10);

  const [screenTimeLimit, blockedApps, lockedPeriods, contactRules] = await Promise.all([
    // Screen time limit compliance
    query(
      `SELECT
         c.daily_screen_time_limit_minutes,
         COUNT(DISTINCT sl.date_recorded)::int AS days_with_usage,
         SUM(CASE WHEN daily_total > c.daily_screen_time_limit_minutes * 60 THEN 1 ELSE 0 END)::int AS days_over_limit
       FROM children c
       LEFT JOIN (
         SELECT device_id, date_recorded, SUM(seconds) AS daily_total
         FROM screen_time_logs
         WHERE date_recorded >= $2
         GROUP BY device_id, date_recorded
       ) sl ON sl.device_id IN (SELECT id FROM devices WHERE child_id = c.id)
       WHERE c.id = $1
       GROUP BY c.daily_screen_time_limit_minutes`,
      [childId, cutoff]
    ),
    // Blocked app violations (access attempts on blocked apps)
    query(
      `SELECT COUNT(*)::int AS blocked_access_count
       FROM app_block_rules abr
       JOIN devices d ON d.id = abr.device_id
       WHERE d.child_id = $1 AND abr.is_blocked = TRUE AND abr.unblock_requested = TRUE`,
      [childId]
    ),
    // Lock period compliance
    query(
      `SELECT COUNT(*)::int AS active_locks
       FROM scheduled_locks
       WHERE child_id = $1 AND is_active = TRUE`,
      [childId]
    ),
    // Contact rules
    query(
      `SELECT
         COUNT(*)::int AS total_rules,
         SUM(CASE WHEN rule_type = 'BLOCK' THEN 1 ELSE 0 END)::int AS blocked_contacts,
         SUM(CASE WHEN rule_type = 'ALLOW' THEN 1 ELSE 0 END)::int AS allowed_contacts
       FROM contact_rules
       WHERE child_id = $1 AND is_active = TRUE`,
      [childId]
    ),
  ]);

  const stLimit = screenTimeLimit.rows[0] || {};
  const limitMinutes = stLimit.daily_screen_time_limit_minutes;
  const daysOverLimit = stLimit.days_over_limit ?? 0;
  const daysWithUsage = stLimit.days_with_usage ?? 0;

  return {
    child_id: childId,
    screen_time: {
      daily_limit_minutes: limitMinutes,
      days_over_limit: daysOverLimit,
      days_with_usage: daysWithUsage,
      compliance_rate: daysWithUsage > 0
        ? Math.round(((daysWithUsage - daysOverLimit) / daysWithUsage) * 100)
        : 100,
    },
    app_blocking: {
      blocked_access_count: blockedApps.rows[0]?.blocked_access_count ?? 0,
    },
    scheduled_locks: {
      active_locks: lockedPeriods.rows[0]?.active_locks ?? 0,
    },
    contact_rules: {
      total_rules: contactRules.rows[0]?.total_rules ?? 0,
      blocked_contacts: contactRules.rows[0]?.blocked_contacts ?? 0,
      allowed_contacts: contactRules.rows[0]?.allowed_contacts ?? 0,
    },
    period: { days: 30, start: cutoff },
  };
};
