// communication-log.service.ts
// CRUD operations for communication logs (SMS/call events from Android).

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset, buildPaginationMeta } from '../../utils/pagination';

export type CommType = 'SMS_IN' | 'SMS_OUT' | 'CALL_IN' | 'CALL_OUT' | 'CALL_MISSED';

export interface CreateCommunicationLogInput {
  comm_type: CommType;
  contact_number?: string;
  contact_name?: string;
  content_snippet?: string;
  duration_seconds?: number;
  recorded_at?: string;
}

const COMM_LOG_COLUMNS = `id, device_id, comm_type, contact_number, contact_name,
  content_snippet, duration_seconds, is_flagged, flag_reason, recorded_at,
  created_at, updated_at`;

/**
 * List communication logs for a child (paginated, parent view).
 */
export const listCommunicationLogs = async (
  parentId: string,
  childId: string,
  page: number,
  limit: number
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const limitNum = Number(limit) || 50;
  const pageNum = Number(page) || 1;
  const offset = toOffset(pageNum, limitNum);

  const [items, countResult] = await Promise.all([
    query(
      `SELECT ${COMM_LOG_COLUMNS} FROM communication_logs cl
       JOIN devices d ON d.id = cl.device_id
       WHERE d.child_id = $1
       ORDER BY cl.recorded_at DESC
       LIMIT $2 OFFSET $3`,
      [childId, limitNum, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM communication_logs cl
       JOIN devices d ON d.id = cl.device_id
       WHERE d.child_id = $1`,
      [childId]
    ),
  ]);

  return {
    data: items.rows,
    meta: buildPaginationMeta(pageNum, limitNum, countResult.rows[0].total),
  };
};

/**
 * Create a communication log entry (called by Android when SMS/call events detected).
 */
export const createCommunicationLog = async (
  parentId: string,
  childId: string,
  input: CreateCommunicationLogInput
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const device = await query(
    `SELECT id FROM devices WHERE child_id = $1 LIMIT 1`,
    [childId]
  );
  if (device.rows.length === 0) throw new NotFoundError('No device found for this child');
  const deviceId = device.rows[0].id;

  // Check content for keyword matches
  let isFlagged = false;
  let flagReason: string | null = null;

  if (input.content_snippet) {
    const keywords = await query(
      `SELECT keyword, category, severity FROM keyword_dictionaries WHERE is_active = TRUE`
    );
    const keywordList = keywords.rows as Array<{ keyword: string; category: string; severity: string }>;
    const lowerContent = input.content_snippet.toLowerCase();
    const matched = keywordList.filter((kw) => lowerContent.includes(kw.keyword.toLowerCase()));
    if (matched.length > 0) {
      isFlagged = true;
      flagReason = `Matched: ${matched.map((m) => m.keyword).join(', ')}`;
    }
  }

  const result = await query(
    `INSERT INTO communication_logs
     (device_id, comm_type, contact_number, contact_name, content_snippet,
      duration_seconds, is_flagged, flag_reason, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COMM_LOG_COLUMNS}`,
    [
      deviceId,
      input.comm_type,
      input.contact_number ?? null,
      input.contact_name ?? null,
      input.content_snippet?.substring(0, 500) ?? null,
      input.duration_seconds ?? null,
      isFlagged,
      flagReason,
      input.recorded_at ?? new Date().toISOString(),
    ]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CREATE_COMMUNICATION_LOG',
    resourceType: 'communication_logs',
    details: { log_id: result.rows[0].id, comm_type: input.comm_type },
  });

  return result.rows[0];
};

/**
 * Get a single communication log by ID.
 */
export const getCommunicationLog = async (
  parentId: string,
  childId: string,
  logId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT ${COMM_LOG_COLUMNS} FROM communication_logs cl
     JOIN devices d ON d.id = cl.device_id
     WHERE cl.id = $1 AND d.child_id = $2`,
    [logId, childId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Communication log not found');
  return result.rows[0];
};

/**
 * Soft delete a communication log (set content_snippet to null and mark as deleted).
 */
export const deleteCommunicationLog = async (
  parentId: string,
  childId: string,
  logId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `DELETE FROM communication_logs cl
     USING devices d
     WHERE cl.id = $1 AND cl.device_id = d.id AND d.child_id = $2
     RETURNING cl.id`,
    [logId, childId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Communication log not found');

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'DELETE_COMMUNICATION_LOG',
    resourceType: 'communication_logs',
    details: { log_id: logId },
  });
};
