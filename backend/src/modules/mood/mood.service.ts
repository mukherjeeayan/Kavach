// mood.service.ts
// Child self-reported mood tracking: create, list, and weekly summary.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

export interface MoodLogInput {
  mood_score: number;
  note?: string;
  activities?: string[];
  device_id?: string;
}

const MOOD_COLUMNS =
  'id, child_id, device_id, mood_score, note, activities, recorded_at, created_at';

/**
 * Create a mood log entry (device-side, child self-report).
 * The device JWT resolves parentId via the devices→children join.
 */
export const createMoodLog = async (
  parentId: string,
  deviceId: string,
  input: MoodLogInput
) => {
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this parent');

  const childId = device.rows[0].child_id;

  const result = await query(
    `INSERT INTO mood_logs (child_id, device_id, mood_score, note, activities)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${MOOD_COLUMNS}`,
    [
      childId,
      deviceId,
      input.mood_score,
      input.note ?? null,
      input.activities ?? null,
    ]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'MOOD_LOG_CREATED',
    resourceType: 'mood_logs',
    details: { mood_id: result.rows[0].id, mood_score: input.mood_score },
  });

  return result.rows[0];
};

/**
 * List mood logs for a child (parent view, paginated).
 */
export const listMoodLogs = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const count = await query(
    `SELECT COUNT(*)::int AS total FROM mood_logs WHERE child_id = $1`,
    [childId]
  );

  const result = await query(
    `SELECT ${MOOD_COLUMNS}
     FROM mood_logs
     WHERE child_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};

/**
 * Get mood summary: average mood_score per ISO week for the child.
 */
export const getMoodSummary = async (
  parentId: string,
  childId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT
       DATE_TRUNC('week', recorded_at)::date AS week_start,
       ROUND(AVG(mood_score)::numeric, 2) AS avg_mood,
       COUNT(*)::int AS entry_count
     FROM mood_logs
     WHERE child_id = $1
     GROUP BY DATE_TRUNC('week', recorded_at)
     ORDER BY week_start DESC
     LIMIT 12`,
    [childId]
  );

  return result.rows;
};
