// communication.service.ts
// SMS/Call log ingestion from the device, flagging, and parent queries.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { sendPushToAllParents } from '../shared/pushNotificationService';
import { toOffset, buildPaginationMeta } from '../../utils/pagination';

export type CommType = 'SMS_IN' | 'SMS_OUT' | 'CALL_IN' | 'CALL_OUT' | 'CALL_MISSED';

export interface CommunicationLogInput {
  comm_type: CommType;
  contact_number?: string;
  contact_name?: string;
  content_snippet?: string;
  duration_seconds?: number;
  recorded_at?: string;
}

/**
 * Batch upload communication logs from the device.
 * Each entry is checked against the keyword dictionary for flagging.
 */
export const recordCommunications = async (
  parentId: string,
  deviceId: string,
  entries: CommunicationLogInput[]
) => {
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this parent');

  const childId = device.rows[0].child_id;

  // Load active keyword dictionaries for flagging
  const keywords = await query(
    `SELECT keyword, category, severity FROM keyword_dictionaries WHERE is_active = TRUE`
  );
  const keywordList = keywords.rows as Array<{ keyword: string; category: string; severity: string }>;

  let flaggedCount = 0;

  for (const entry of entries) {
    // Check content for keyword matches
    let isFlagged = false;
    let flagReason: string | null = null;

    if (entry.content_snippet && keywordList.length > 0) {
      const lowerContent = entry.content_snippet.toLowerCase();
      const matched = keywordList.filter((kw) => lowerContent.includes(kw.keyword.toLowerCase()));
      if (matched.length > 0) {
        isFlagged = true;
        flagReason = `Matched: ${matched.map((m) => m.keyword).join(', ')}`;
        flaggedCount++;

        // Also create a keyword alert entry
        await query(
          `INSERT INTO keyword_alerts
           (device_id, child_id, source_type, detected_keywords, severity, content_snippet)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            deviceId,
            childId,
            entry.comm_type.startsWith('SMS') ? 'SMS' : 'APP_TEXT',
            matched.map((m) => m.keyword),
            matched.reduce((max, m) => {
              const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
              return order.indexOf(m.severity) > order.indexOf(max) ? m.severity : max;
            }, 'LOW'),
            entry.content_snippet?.substring(0, 500) ?? null,
          ]
        );
      }
    }

    await query(
      `INSERT INTO communication_logs
       (device_id, comm_type, contact_number, contact_name, content_snippet,
        duration_seconds, is_flagged, flag_reason, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        deviceId,
        entry.comm_type,
        entry.contact_number ?? null,
        entry.contact_name ?? null,
        entry.content_snippet?.substring(0, 500) ?? null,
        entry.duration_seconds ?? null,
        isFlagged,
        flagReason,
        entry.recorded_at ?? new Date().toISOString(),
      ]
    );
  }

  if (flaggedCount > 0) {
    await writeAuditLog({
      actorId: parentId,
      targetChildId: childId,
      action: 'FLAGGED_COMMUNICATION',
      resourceType: 'communication_logs',
      details: { device_id: deviceId, total: entries.length, flagged: flaggedCount },
    });

    await sendPushToAllParents(
      childId,
      'Content Alert',
      `${flaggedCount} flagged item${flaggedCount === 1 ? '' : 's'} detected`,
      {
        type: 'keyword_alert',
        device_id: deviceId,
        child_id: childId,
        flagged_count: String(flaggedCount),
      }
    );
  }

  return { uploaded: entries.length, flagged: flaggedCount };
};

/**
 * List communication logs for a child (paginated, parent view).
 */
export const listCommunications = async (
  parentId: string,
  childId: string,
  page: number,
  limit: number,
  flaggedOnly: boolean = false
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const limitNum = Number(limit) || 50;
  const pageNum = Number(page) || 1;
  const offset = toOffset(pageNum, limitNum);

  const flagFilter = flaggedOnly ? 'AND cl.is_flagged = TRUE' : '';

  const [items, countResult] = await Promise.all([
    query(
      `SELECT cl.* FROM communication_logs cl
       JOIN devices d ON d.id = cl.device_id
       WHERE d.child_id = $1 ${flagFilter}
       ORDER BY cl.recorded_at DESC
       LIMIT $2 OFFSET $3`,
      [childId, limitNum, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM communication_logs cl
       JOIN devices d ON d.id = cl.device_id
       WHERE d.child_id = $1 ${flagFilter}`,
      [childId]
    ),
  ]);

  const total = countResult.rows[0].total;
  return {
    data: items.rows,
    meta: buildPaginationMeta(pageNum, limitNum, total)
  };
};

/**
 * List keyword alerts for a child (parent view).
 */
export const listKeywordAlerts = async (
  parentId: string,
  childId: string,
  unreviewedOnly: boolean = false
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const filter = unreviewedOnly ? 'AND is_reviewed = FALSE' : '';
  const result = await query(
    `SELECT * FROM keyword_alerts
     WHERE child_id = $1 ${filter}
     ORDER BY created_at DESC
     LIMIT 100`,
    [childId]
  );
  return result.rows;
};

/**
 * Mark a keyword alert as reviewed.
 */
export const reviewKeywordAlert = async (
  parentId: string,
  childId: string,
  alertId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `UPDATE keyword_alerts
     SET is_reviewed = TRUE, reviewed_at = now()
     WHERE id = $1 AND child_id = $2
     RETURNING *`,
    [alertId, childId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Keyword alert not found');
  return result.rows[0];
};
