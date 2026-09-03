// alerts.service.ts
// Business logic for alerts. Aggregates alerts from multiple sources
// (audit_logs, keyword_alerts, self_harm_alerts, sos_events, etc.)
// into a unified interface.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { toOffset } from '../../utils/pagination';
import { verifyChildBelongsToParent } from '../children/children.service';
import { sendPushToAllParents } from '../shared/pushNotificationService';
import type { AlertsQueryInput } from './alerts.dto';

export interface Alert {
  id: string;
  child_id: string;
  alert_type: string;
  title: string;
  description: string;
  severity: string;
  reference_id: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

/**
 * Get alerts for a child from multiple sources.
 */
export const getAlerts = async (
  parentId: string,
  childId: string,
  params: AlertsQueryInput
): Promise<{ items: Alert[]; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const { page, limit, alert_type, unacknowledged_only } = params;
  const offset = toOffset(page, limit);

  // Build UNION query from different alert sources
  const conditions: string[] = [];
  const values: any[] = [childId];
  let paramIndex = 2;

  // Audit log alerts (tamper, screen time limits)
  const auditAlerts = `
    SELECT
      al.id,
      $1 AS child_id,
      al.action AS alert_type,
      al.action AS title,
      COALESCE(al.details->>'message', al.action) AS description,
      CASE
        WHEN al.action IN ('TAMPER_ALERT', 'DEVICE_ADMIN_STATUS') THEN 'HIGH'
        WHEN al.action IN ('SCREEN_TIME_LIMIT_REACHED', 'PER_APP_LIMIT_REACHED') THEN 'MEDIUM'
        ELSE 'LOW'
      END AS severity,
      al.id AS reference_id,
      al.acknowledged_at IS NOT NULL AS is_acknowledged,
      al.acknowledged_at,
      al.created_at
    FROM audit_logs al
    WHERE al.target_child_id = $1
      AND al.action IN ('TAMPER_ALERT', 'SCREEN_TIME_LIMIT_REACHED', 'PER_APP_LIMIT_REACHED', 'DEVICE_ADMIN_STATUS')
  `;

  // Keyword alerts
  const keywordAlerts = `
    SELECT
      ka.id,
      $1 AS child_id,
      'KEYWORD_ALERT' AS alert_type,
      'Keyword Alert' AS title,
      COALESCE(ka.content_snippet, 'Detected flagged content') AS description,
      ka.severity,
      ka.id AS reference_id,
      ka.is_reviewed AS is_acknowledged,
      ka.reviewed_at AS acknowledged_at,
      ka.created_at
    FROM keyword_alerts ka
    WHERE ka.child_id = $1
  `;

  // Self-harm alerts
  const selfHarmAlerts = `
    SELECT
      sha.id,
      $1 AS child_id,
      'SELF_HARM_ALERT' AS alert_type,
      'Self-Harm Alert' AS title,
      COALESCE(sha.content_snippet, 'Potential self-harm content detected') AS description,
      sha.risk_level AS severity,
      sha.id AS reference_id,
      sha.is_acknowledged,
      sha.acknowledged_at,
      sha.created_at
    FROM self_harm_alerts sha
    WHERE sha.child_id = $1
  `;

  // SOS events
  const sosEvents = `
    SELECT
      se.id,
      $1 AS child_id,
      'SOS_EVENT' AS alert_type,
      'SOS Event' AS title,
      COALESCE(se.notes, 'Emergency SOS triggered') AS description,
      'CRITICAL' AS severity,
      se.id AS reference_id,
      se.status != 'ACTIVE' AS is_acknowledged,
      se.acknowledged_at,
      se.created_at
    FROM emergency_sos_events se
    WHERE se.child_id = $1
  `;

  // Geofence events
  const geofenceEvents = `
    SELECT
      ge.id,
      $1 AS child_id,
      'GEOFENCE_EVENT' AS alert_type,
      'Geofence Alert' AS title,
      CONCAT(ge.event_type, ' zone: ', g.name) AS description,
      'MEDIUM' AS severity,
      ge.id AS reference_id,
      false AS is_acknowledged,
      NULL::timestamptz AS acknowledged_at,
      ge.created_at
    FROM geofence_events ge
    JOIN geofences g ON g.id = ge.geofence_id
    WHERE g.child_id = $1
  `;

  // Combine all sources
  const allAlerts = `
    (${auditAlerts})
    UNION ALL
    (${keywordAlerts})
    UNION ALL
    (${selfHarmAlerts})
    UNION ALL
    (${sosEvents})
    UNION ALL
    (${geofenceEvents})
  `;

  // Build the final query with filters
  let filteredQuery = `SELECT * FROM (${allAlerts}) AS combined`;
  const filterConditions: string[] = [];

  if (alert_type) {
    filterConditions.push(`alert_type = $${paramIndex}`);
    values.push(alert_type);
    paramIndex++;
  }

  if (unacknowledged_only) {
    filterConditions.push(`is_acknowledged = false`);
  }

  if (filterConditions.length > 0) {
    filteredQuery += ` WHERE ${filterConditions.join(' AND ')}`;
  }

  // Get total count
  const countQuery = `SELECT COUNT(*)::int AS total FROM (${filteredQuery}) AS counted`;
  const countResult = await query(countQuery, values);
  const total = countResult.rows[0].total;

  // Get paginated results
  filteredQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  values.push(limit, offset);

  const result = await query(filteredQuery, values);

  return {
    items: result.rows as Alert[],
    total,
  };
};

/**
 * Get a single alert by ID and verify child ownership.
 */
export const getAlertById = async (
  parentId: string,
  childId: string,
  alertId: string
): Promise<Alert> => {
  await verifyChildBelongsToParent(childId, parentId);

  // Try to find in audit_logs first
  let result = await query(
    `SELECT
      al.id,
      $2 AS child_id,
      al.action AS alert_type,
      al.action AS title,
      COALESCE(al.details->>'message', al.action) AS description,
      'MEDIUM' AS severity,
      al.id AS reference_id,
      al.acknowledged_at IS NOT NULL AS is_acknowledged,
      al.acknowledged_at,
      al.created_at
    FROM audit_logs al
    WHERE al.id = $1 AND al.target_child_id = $2`,
    [alertId, childId]
  );

  if (result.rows.length > 0) {
    return result.rows[0] as Alert;
  }

  // Try keyword_alerts
  result = await query(
    `SELECT
      ka.id,
      $2 AS child_id,
      'KEYWORD_ALERT' AS alert_type,
      'Keyword Alert' AS title,
      COALESCE(ka.content_snippet, 'Detected flagged content') AS description,
      ka.severity,
      ka.id AS reference_id,
      ka.is_reviewed AS is_acknowledged,
      ka.reviewed_at AS acknowledged_at,
      ka.created_at
    FROM keyword_alerts ka
    WHERE ka.id = $1 AND ka.child_id = $2`,
    [alertId, childId]
  );

  if (result.rows.length > 0) {
    return result.rows[0] as Alert;
  }

  // Try self_harm_alerts
  result = await query(
    `SELECT
      sha.id,
      $2 AS child_id,
      'SELF_HARM_ALERT' AS alert_type,
      'Self-Harm Alert' AS title,
      COALESCE(sha.content_snippet, 'Potential self-harm content detected') AS description,
      sha.risk_level AS severity,
      sha.id AS reference_id,
      sha.is_acknowledged,
      sha.acknowledged_at,
      sha.created_at
    FROM self_harm_alerts sha
    WHERE sha.id = $1 AND sha.child_id = $2`,
    [alertId, childId]
  );

  if (result.rows.length > 0) {
    return result.rows[0] as Alert;
  }

  // Try sos_events
  result = await query(
    `SELECT
      se.id,
      $2 AS child_id,
      'SOS_EVENT' AS alert_type,
      'SOS Event' AS title,
      COALESCE(se.notes, 'Emergency SOS triggered') AS description,
      'CRITICAL' AS severity,
      se.id AS reference_id,
      se.status != 'ACTIVE' AS is_acknowledged,
      se.acknowledged_at,
      se.created_at
    FROM emergency_sos_events se
    WHERE se.id = $1 AND se.child_id = $2`,
    [alertId, childId]
  );

  if (result.rows.length > 0) {
    return result.rows[0] as Alert;
  }

  throw new NotFoundError('Alert not found');
};

/**
 * Mark an alert as read/acknowledged.
 */
export const markAsRead = async (
  parentId: string,
  childId: string,
  alertId: string
): Promise<Alert> => {
  const alert = await getAlertById(parentId, childId, alertId);

  if (alert.is_acknowledged) {
    return alert;
  }

  // Try to update in the appropriate table based on alert_type
  if (alert.alert_type === 'KEYWORD_ALERT') {
    await query(
      `UPDATE keyword_alerts SET is_reviewed = true, reviewed_at = now() WHERE id = $1`,
      [alertId]
    );
  } else if (alert.alert_type === 'SELF_HARM_ALERT') {
    await query(
      `UPDATE self_harm_alerts SET is_acknowledged = true, acknowledged_at = now() WHERE id = $1`,
      [alertId]
    );
  } else if (alert.alert_type === 'SOS_EVENT') {
    await query(
      `UPDATE emergency_sos_events SET status = 'ACKNOWLEDGED', acknowledged_at = now() WHERE id = $1`,
      [alertId]
    );
  } else if (['TAMPER_ALERT', 'SCREEN_TIME_LIMIT_REACHED', 'PER_APP_LIMIT_REACHED', 'DEVICE_ADMIN_STATUS'].includes(alert.alert_type)) {
    await query(
      `UPDATE audit_logs SET acknowledged_at = now() WHERE id = $1`,
      [alertId]
    );
  }

  // Re-fetch the updated alert
  const updated = await getAlertById(parentId, childId, alertId);

  await sendPushToAllParents(
    childId,
    'Alert',
    `${updated.alert_type} acknowledged`,
    {
      type: 'alert',
      alert_id: alertId,
      alert_type: updated.alert_type,
      child_id: childId,
    }
  );

  return updated;
};

/**
 * Delete an alert (soft delete by acknowledging).
 */
export const deleteAlert = async (
  parentId: string,
  childId: string,
  alertId: string
): Promise<{ deleted: boolean }> => {
  const alert = await getAlertById(parentId, childId, alertId);

  // Mark as acknowledged (soft delete)
  if (!alert.is_acknowledged) {
    await markAsRead(parentId, childId, alertId);
  }

  return { deleted: true };
};
