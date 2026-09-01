// analytics.service.ts
// Pre-computed weekly/monthly usage reports, plus ad-hoc category breakdowns.
// Optionally generates AI-powered narrative summaries when the user has an
// AI provider configured.

import { query } from '../../config/database';
import { verifyChildBelongsToParent } from '../children/children.service';
import { generateAiResponse, hasAiConfig } from '../ai/ai.service';

/**
 * Generate a comprehensive usage report for the given period.
 * Pulls from screen_time_logs, location_logs, communication_logs,
 * and keyword_alerts to give a holistic view.
 */
export const generateReport = async (
  parentId: string,
  childId: string,
  reportType: 'WEEKLY' | 'MONTHLY'
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const rangeDays = reportType === 'MONTHLY' ? 30 : 7;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - rangeDays);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = new Date().toISOString().slice(0, 10);

  // Screen time summary
  const screenTime = await query(
    `SELECT date_recorded, app_package, COALESCE(app_category, 'unknown') AS app_category,
            SUM(seconds)::int AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded >= $1
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY date_recorded, app_package, app_category
     ORDER BY date_recorded ASC, total_seconds DESC`,
    [periodStartStr, childId]
  );

  // Daily totals
  const dailyTotals = await query(
    `SELECT date_recorded, SUM(seconds)::int AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded >= $1
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY date_recorded ORDER BY date_recorded ASC`,
    [periodStartStr, childId]
  );

  // Category breakdown
  const categoryBreakdown = await query(
    `SELECT COALESCE(app_category, 'unknown') AS category, SUM(seconds)::int AS total_seconds
     FROM screen_time_logs
     WHERE date_recorded >= $1
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY app_category ORDER BY total_seconds DESC`,
    [periodStartStr, childId]
  );

  // Location activity count
  const locationCount = await query(
    `SELECT COUNT(*)::int AS total_pings FROM location_logs
     WHERE recorded_at >= $1::date
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)`,
    [periodStartStr, childId]
  );

  // Communication stats
  const commStats = await query(
    `SELECT comm_type, COUNT(*)::int AS count, SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END)::int AS flagged
     FROM communication_logs
     WHERE recorded_at >= $1::date
       AND device_id IN (SELECT id FROM devices WHERE child_id = $2)
     GROUP BY comm_type`,
    [periodStartStr, childId]
  );

  // Keyword alert count
  const alertCount = await query(
    `SELECT severity, COUNT(*)::int AS count FROM keyword_alerts
     WHERE created_at >= $1::date AND child_id = $2
     GROUP BY severity`,
    [periodStartStr, childId]
  );

  const reportData = {
    period: { start: periodStartStr, end: periodEndStr, type: reportType },
    screen_time: {
      daily_totals: dailyTotals.rows,
      by_app: screenTime.rows,
      by_category: categoryBreakdown.rows,
      grand_total_seconds: dailyTotals.rows.reduce(
        (acc: number, r: { total_seconds: number }) => acc + r.total_seconds, 0
      ),
    },
    location: { total_pings: locationCount.rows[0]?.total_pings ?? 0 },
    communications: commStats.rows,
    keyword_alerts: alertCount.rows,
  };

  // Try AI narrative generation (non-blocking — falls back gracefully)
  let aiNarrative: string | null = null;
  try {
    if (await hasAiConfig(parentId)) {
      const prompt = buildAnalyticsPrompt(reportData, reportType);
      aiNarrative = await generateAiResponse(parentId, prompt);
    }
  } catch {
    // AI unavailable — report still valid with rule-based data
  }

  const enrichedReport = {
    ...reportData,
    ai_narrative: aiNarrative,
  };

  // Cache the report
  await query(
    `INSERT INTO analytics_reports (child_id, report_type, period_start, period_end, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (child_id, report_type, period_start)
     DO UPDATE SET data = EXCLUDED.data, generated_at = now()`,
    [childId, reportType, periodStartStr, periodEndStr, JSON.stringify(enrichedReport)]
  );

  return enrichedReport;
};

/**
 * Get a previously generated report (from cache).
 */
export const getCachedReport = async (
  parentId: string,
  childId: string,
  reportType: 'WEEKLY' | 'MONTHLY'
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT * FROM analytics_reports
     WHERE child_id = $1 AND report_type = $2
     ORDER BY period_start DESC LIMIT 1`,
    [childId, reportType]
  );
  return result.rows[0] ?? null;
};

/**
 * List all available reports for a child.
 */
export const listReports = async (
  parentId: string,
  childId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT id, report_type, period_start, period_end, generated_at
     FROM analytics_reports
     WHERE child_id = $1
     ORDER BY period_start DESC
     LIMIT 20`,
    [childId]
  );
  return result.rows;
};

/**
 * Build a structured prompt for AI narrative generation from report data.
 */
const buildAnalyticsPrompt = (
  reportData: Record<string, unknown>,
  reportType: 'WEEKLY' | 'MONTHLY'
): string => {
  const data = reportData as {
    period: { start: string; end: string };
    screen_time: {
      grand_total_seconds: number;
      daily_totals: { date_recorded: string; total_seconds: number }[];
      by_category: { category: string; total_seconds: number }[];
    };
    communications: { comm_type: string; count: number; flagged: number }[];
    keyword_alerts: { severity: string; count: number }[];
    location: { total_pings: number };
  };

  const hours = (data.screen_time.grand_total_seconds / 3600).toFixed(1);
  const avgDaily = (data.screen_time.grand_total_seconds / data.screen_time.daily_totals.length / 3600).toFixed(1);
  const categories = data.screen_time.by_category
    .slice(0, 5)
    .map((c) => `${c.category}: ${(c.total_seconds / 3600).toFixed(1)}h`)
    .join(', ');
  const commSummary = data.communications
    .map((c) => `${c.comm_type}: ${c.count} total, ${c.flagged} flagged`)
    .join('; ');
  const alertsSummary = data.keyword_alerts
    .map((a) => `${a.severity}: ${a.count}`)
    .join(', ');

  return `Analyze this child's ${reportType.toLowerCase()} digital wellness data and provide a brief, supportive summary (3-5 sentences). Focus on trends, concerns, and positive observations.

Period: ${data.period.start} to ${data.period.end}
Screen time: ${hours}h total, ~${avgDaily}h/day average
Top categories: ${categories || 'None logged'}
Communications: ${commSummary || 'None logged'}
Keyword alerts: ${alertsSummary || 'None'}
Location pings: ${data.location.total_pings}

Write a caring, actionable summary for a parent. Highlight any concerning patterns and suggest specific improvements. Keep it under 150 words.`;
};
