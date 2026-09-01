// prediction.service.ts
// Behavior prediction engine. Uses rule-based analysis with optional
// AI-powered insights when the user has an AI provider configured.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { generateAiResponse, hasAiConfig } from '../ai/ai.service';

export type PredictionType =
  | 'HIGH_RISK_TIME'
  | 'SCREEN_TIME_TREND'
  | 'APP_USAGE_PATTERN'
  | 'SOCIAL_RISK';

interface PredictionRecord {
  id: string;
  child_id: string;
  prediction_type: string;
  confidence: number;
  risk_score: number;
  prediction_data: Record<string, unknown>;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

const SCREEN_TIME_HIGH_THRESHOLD = 3600; // 1 hour per day
const FLAGGED_COMM_INCREASING_THRESHOLD = 3;

/**
 * Generate behavior predictions for a child based on recent data.
 * This is a simple rule-based system (not ML).
 */
export const generatePredictions = async (
  parentId: string,
  childId: string
): Promise<PredictionRecord[]> => {
  await verifyChildBelongsToParent(childId, parentId);

  const predictions: Omit<PredictionRecord, 'id' | 'created_at'>[] = [];
  const now = new Date();
  const validFrom = now.toISOString();
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Rule 1: HIGH_RISK_TIME ──────────────────────────────────
  // Check if screen time exceeds threshold in the last 3 days
  const screenTimeResult = await query(
    `SELECT
       date_recorded,
       SUM(seconds)::int AS total_seconds
     FROM screen_time_logs stl
     JOIN devices d ON d.id = stl.device_id
     WHERE d.child_id = $1
       AND date_recorded >= CURRENT_DATE - INTERVAL '3 days'
     GROUP BY date_recorded
     ORDER BY date_recorded DESC`,
    [childId]
  );

  if (screenTimeResult.rows.length > 0) {
    const avgScreenTime =
      screenTimeResult.rows.reduce(
        (sum: number, r: Record<string, unknown>) => sum + ((r.total_seconds as number) || 0),
        0
      ) / screenTimeResult.rows.length;

    if (avgScreenTime > SCREEN_TIME_HIGH_THRESHOLD) {
      const confidence = Math.min(avgScreenTime / (SCREEN_TIME_HIGH_THRESHOLD * 2), 0.95);
      const riskScore = Math.min(Math.round((avgScreenTime / (SCREEN_TIME_HIGH_THRESHOLD * 3)) * 100), 100);

      predictions.push({
        child_id: childId,
        prediction_type: 'HIGH_RISK_TIME',
        confidence: Math.round(confidence * 100) / 100,
        risk_score: riskScore,
        prediction_data: {
          avg_daily_seconds: Math.round(avgScreenTime),
          threshold_seconds: SCREEN_TIME_HIGH_THRESHOLD,
          days_analyzed: screenTimeResult.rows.length,
        },
        valid_from: validFrom,
        valid_until: validUntil,
        is_active: true,
      });
    }
  }

  // ── Rule 2: SCREEN_TIME_TREND ───────────────────────────────
  // Compare last 3 days vs previous 3 days
  const recentScreenTime = await query(
    `SELECT SUM(seconds)::int AS total_seconds
     FROM screen_time_logs stl
     JOIN devices d ON d.id = stl.device_id
     WHERE d.child_id = $1 AND date_recorded >= CURRENT_DATE - INTERVAL '3 days'`,
    [childId]
  );

  const olderScreenTime = await query(
    `SELECT SUM(seconds)::int AS total_seconds
     FROM screen_time_logs stl
     JOIN devices d ON d.id = stl.device_id
     WHERE d.child_id = $1
       AND date_recorded >= CURRENT_DATE - INTERVAL '6 days'
       AND date_recorded < CURRENT_DATE - INTERVAL '3 days'`,
    [childId]
  );

  const recent = recentScreenTime.rows[0]?.total_seconds || 0;
  const older = olderScreenTime.rows[0]?.total_seconds || 0;

  if (older > 0 && recent > 0) {
    const changePercent = ((recent - older) / older) * 100;

    if (Math.abs(changePercent) > 20) {
      const trend = changePercent > 0 ? 'INCREASING' : 'DECREASING';
      const riskScore = changePercent > 0
        ? Math.min(Math.round(changePercent / 2), 100)
        : Math.max(Math.round(changePercent / 5), 0);

      predictions.push({
        child_id: childId,
        prediction_type: 'SCREEN_TIME_TREND',
        confidence: 0.7,
        risk_score: riskScore,
        prediction_data: {
          trend,
          change_percent: Math.round(changePercent),
          recent_total_seconds: recent,
          older_total_seconds: older,
        },
        valid_from: validFrom,
        valid_until: validUntil,
        is_active: true,
      });
    }
  }

  // ── Rule 3: SOCIAL_RISK ─────────────────────────────────────
  // Check if flagged communications are increasing
  const recentFlagged = await query(
    `SELECT COUNT(*)::int AS flagged_count
     FROM communication_logs cl
     JOIN devices d ON d.id = cl.device_id
     WHERE d.child_id = $1
       AND cl.is_flagged = TRUE
       AND cl.recorded_at >= now() - INTERVAL '3 days'`,
    [childId]
  );

  const olderFlagged = await query(
    `SELECT COUNT(*)::int AS flagged_count
     FROM communication_logs cl
     JOIN devices d ON d.id = cl.device_id
     WHERE d.child_id = $1
       AND cl.is_flagged = TRUE
       AND cl.recorded_at >= now() - INTERVAL '7 days'
       AND cl.recorded_at < now() - INTERVAL '3 days'`,
    [childId]
  );

  const recentFlagCount = recentFlagged.rows[0]?.flagged_count || 0;
  const olderFlagCount = olderFlagged.rows[0]?.flagged_count || 0;

  if (recentFlagCount >= FLAGGED_COMM_INCREASING_THRESHOLD) {
    const confidence = Math.min(0.5 + recentFlagCount * 0.1, 0.95);
    const riskScore = Math.min(recentFlagCount * 10, 100);

    predictions.push({
      child_id: childId,
      prediction_type: 'SOCIAL_RISK',
      confidence: Math.round(confidence * 100) / 100,
      risk_score: riskScore,
      prediction_data: {
        recent_flagged_count: recentFlagCount,
        previous_flagged_count: olderFlagCount,
        trend: recentFlagCount > olderFlagCount ? 'INCREASING' : 'STABLE',
      },
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: true,
    });
  }

  // ── Rule 4: APP_USAGE_PATTERN ───────────────────────────────
  // Check for excessive usage of specific app categories
  const categoryUsage = await query(
    `SELECT
       app_category,
       SUM(seconds)::int AS total_seconds
     FROM screen_time_logs stl
     JOIN devices d ON d.id = stl.device_id
     WHERE d.child_id = $1
       AND date_recorded >= CURRENT_DATE - INTERVAL '7 days'
       AND app_category IS NOT NULL
     GROUP BY app_category
     HAVING SUM(seconds) > 3600
     ORDER BY total_seconds DESC
     LIMIT 5`,
    [childId]
  );

  if (categoryUsage.rows.length > 0) {
    const topCategories = categoryUsage.rows.map((r: Record<string, unknown>) => ({
      category: r.app_category,
      total_seconds: r.total_seconds,
    }));

    predictions.push({
      child_id: childId,
      prediction_type: 'APP_USAGE_PATTERN',
      confidence: 0.65,
      risk_score: Math.min(categoryUsage.rows.length * 15, 100),
      prediction_data: {
        high_usage_categories: topCategories,
        analysis_period: '7 days',
      },
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: true,
    });
  }

  // ── Deactivate old predictions and insert new ────────────────
  await query(
    `UPDATE behavior_predictions SET is_active = FALSE WHERE child_id = $1 AND is_active = TRUE`,
    [childId]
  );

  const inserted: PredictionRecord[] = [];
  for (const pred of predictions) {
    const result = await query(
      `INSERT INTO behavior_predictions
       (child_id, prediction_type, confidence, risk_score, prediction_data, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        pred.child_id,
        pred.prediction_type,
        pred.confidence,
        pred.risk_score,
        JSON.stringify(pred.prediction_data),
        pred.valid_from,
        pred.valid_until,
      ]
    );
    inserted.push(result.rows[0] as unknown as PredictionRecord);
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'PREDICTIONS_GENERATED',
    resourceType: 'behavior_predictions',
    details: { prediction_count: inserted.length, types: inserted.map((p) => p.prediction_type) },
  });

  return inserted;
};

/**
 * List active predictions for a child (parent view).
 */
export const listPredictions = async (
  parentId: string,
  childId: string
): Promise<PredictionRecord[]> => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT * FROM behavior_predictions
     WHERE child_id = $1
       AND is_active = TRUE
       AND valid_until > now()
     ORDER BY created_at DESC
     LIMIT 20`,
    [childId]
  );

  return result.rows as unknown as PredictionRecord[];
};

/**
 * Generate an AI-powered behavioral insight summary for a child.
 * Returns null if no AI provider is configured.
 */
export const generateAiInsight = async (
  parentId: string,
  childId: string
): Promise<string | null> => {
  try {
    if (!(await hasAiConfig(parentId))) return null;

    const predictions = await query(
      `SELECT prediction_type, risk_score, confidence, prediction_data
       FROM behavior_predictions
       WHERE child_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 10`,
      [childId]
    );

    const screenTime = await query(
      `SELECT date_recorded, SUM(seconds)::int AS total_seconds
       FROM screen_time_logs stl JOIN devices d ON d.id = stl.device_id
       WHERE d.child_id = $1 AND date_recorded >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY date_recorded ORDER BY date_recorded DESC`,
      [childId]
    );

    const alertCount = await query(
      `SELECT severity, COUNT(*)::int AS count
       FROM keyword_alerts WHERE child_id = $1
         AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY severity`,
      [childId]
    );

    const prompt = `You are a child safety analyst. Based on this data, provide a brief AI insight (2-4 sentences) about the child's digital behavior this week. Be supportive and actionable.

Recent predictions: ${JSON.stringify(predictions.rows)}
Screen time (last 7 days): ${JSON.stringify(screenTime.rows)}
Keyword alerts: ${JSON.stringify(alertCount.rows)}

Write a caring, specific insight for the parent.`;

    return await generateAiResponse(parentId, prompt);
  } catch {
    return null;
  }
};
