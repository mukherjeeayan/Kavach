// selfHarm.service.ts
// Self-harm alert management: list, acknowledge, unacknowledged count.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

const ALERT_COLUMNS = `id, child_id, device_id, source_type, detected_keywords, content_snippet, risk_level, is_acknowledged, acknowledged_at, acknowledged_by, created_at`;

export const listAlerts = async (
  parentId: string,
  childId: string,
  unacknowledgedOnly?: boolean,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const params: unknown[] = [childId];
  let whereClause = 'WHERE child_id = $1';

  if (unacknowledgedOnly) {
    whereClause += ' AND is_acknowledged = FALSE';
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM self_harm_alerts ${whereClause}`,
    params
  );

  const result = await query(
    `SELECT ${ALERT_COLUMNS}
     FROM self_harm_alerts
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [...params, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: countResult.rows[0].total };
};

export const acknowledgeAlert = async (
  parentId: string,
  childId: string,
  alertId: string
): Promise<Record<string, unknown>> => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `UPDATE self_harm_alerts
     SET is_acknowledged = TRUE,
         acknowledged_at = now(),
         acknowledged_by = $1
     WHERE id = $2 AND child_id = $3 AND is_acknowledged = FALSE
     RETURNING ${ALERT_COLUMNS}`,
    [parentId, alertId, childId]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Unacknowledged self-harm alert not found for this child');
  }

  const alert = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SELF_HARM_ALERT_ACKNOWLEDGED',
    resourceType: 'self_harm_alerts',
    details: { alert_id: alertId, risk_level: alert.risk_level },
  });

  return alert;
};

export const getUnacknowledgedCount = async (
  childId: string
): Promise<number> => {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM self_harm_alerts WHERE child_id = $1 AND is_acknowledged = FALSE`,
    [childId]
  );
  return result.rows[0].count;
};
