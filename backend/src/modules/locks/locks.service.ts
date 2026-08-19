// locks.service.ts
// Scheduled lock windows: during a window the device locks everything
// except a small whitelist. Windows are child-scoped and every read or
// write verifies the child belongs to the authenticated parent.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent, ensureDeviceBelongsToChild } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

export interface LockInput {
  device_id?: string;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

const LOCK_COLUMNS = `id, child_id, device_id, day_of_week, start_time, end_time, is_active, created_at, updated_at`;

export const listLocks = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);
  const count = await query(`SELECT COUNT(*)::int AS total FROM scheduled_locks WHERE child_id = $1`, [
    childId,
  ]);
  const result = await query(
    `SELECT ${LOCK_COLUMNS}
     FROM scheduled_locks
     WHERE child_id = $1
     ORDER BY day_of_week NULLS LAST, start_time ASC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );
  return { items: result.rows, total: count.rows[0].total };
};

export const createLock = async (
  parentId: string,
  childId: string,
  input: LockInput
): Promise<Record<string, unknown>> => {
  await verifyChildBelongsToParent(childId, parentId);
  await ensureDeviceBelongsToChild(childId, input.device_id);

  const result = await query(
    `INSERT INTO scheduled_locks (child_id, device_id, day_of_week, start_time, end_time, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${LOCK_COLUMNS}`,
    [
      childId,
      input.device_id || null,
      input.day_of_week ?? null,
      input.start_time,
      input.end_time,
      input.is_active ?? true,
    ]
  );
  const lock = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CREATE_LOCK',
    resourceType: 'scheduled_locks',
    details: { lock_id: lock.id, start_time: lock.start_time, end_time: lock.end_time },
  });

  return lock;
};

export const updateLock = async (
  parentId: string,
  childId: string,
  lockId: string,
  input: Partial<LockInput>
): Promise<Record<string, unknown>> => {
  await verifyChildBelongsToParent(childId, parentId);
  await ensureDeviceBelongsToChild(childId, input.device_id);

  const result = await query(
    `UPDATE scheduled_locks
     SET device_id = COALESCE($3, device_id),
         day_of_week = COALESCE($4, day_of_week),
         start_time = COALESCE($5, start_time),
         end_time = COALESCE($6, end_time),
         is_active = COALESCE($7, is_active),
         updated_at = now()
     WHERE id = $1 AND child_id = $2
     RETURNING ${LOCK_COLUMNS}`,
    [
      lockId,
      childId,
      input.device_id ?? null,
      input.day_of_week === undefined ? null : input.day_of_week,
      input.start_time ?? null,
      input.end_time ?? null,
      input.is_active === undefined ? null : input.is_active,
    ]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Scheduled lock not found for this child');
  }
  const lock = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'UPDATE_LOCK',
    resourceType: 'scheduled_locks',
    details: { lock_id: lock.id },
  });

  return lock;
};

export const deleteLock = async (
  parentId: string,
  childId: string,
  lockId: string
): Promise<void> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `DELETE FROM scheduled_locks WHERE id = $1 AND child_id = $2`,
    [lockId, childId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Scheduled lock not found for this child');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'DELETE_LOCK',
    resourceType: 'scheduled_locks',
    details: { lock_id: lockId },
  });
};
