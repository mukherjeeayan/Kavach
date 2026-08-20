// children.service.ts
// Business logic for child profiles. Every operation verifies that
// the child belongs to the authenticated parent before touching data.

import { query } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { toOffset } from '../../utils/pagination';
import { writeAuditLog } from '../shared/audit.service';

export interface ChildProfile {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string | null;
  daily_screen_time_limit_minutes: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Verify a child belongs to the given parent. Throws ForbiddenError
 * when the relationship does not exist — used by every child-scoped
 * operation (app blocking, device registration, alerts, ...).
 */
export const verifyChildBelongsToParent = async (
  childId: string,
  parentId: string
): Promise<void> => {
  const result = await query(
    `SELECT id FROM children WHERE id = $1 AND parent_id = $2`,
    [childId, parentId]
  );
  if (result.rows.length === 0) {
    throw new ForbiddenError('Child does not belong to this parent');
  }
};

/**
 * If a device_id is given, make sure it belongs to the child. Shared
 * by locks/contacts/app-blocking so a parent can never attach a rule
 * to another parent's device.
 */
export const ensureDeviceBelongsToChild = async (
  childId: string,
  deviceId?: string
): Promise<void> => {
  if (!deviceId) return;
  const result = await query(`SELECT id FROM devices WHERE id = $1 AND child_id = $2`, [
    deviceId,
    childId,
  ]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Device not found for this child');
  }
};

/**
 * List all child profiles for a parent (ordered by creation time),
 * paginated.
 */
export const listChildren = async (
  parentId: string,
  page = 1,
  limit = 20
): Promise<{ items: ChildProfile[]; total: number }> => {
  const count = await query(`SELECT COUNT(*)::int AS total FROM children WHERE parent_id = $1`, [
    parentId,
  ]);
  const result = await query(
    `SELECT id, parent_id, name, birth_date, daily_screen_time_limit_minutes, created_at, updated_at
     FROM children
     WHERE parent_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [parentId, limit, toOffset(page, limit)]
  );
  return { items: result.rows, total: count.rows[0].total };
};

/**
 * Create a child profile for the authenticated parent.
 */
export const createChild = async (
  parentId: string,
  name: string,
  birthDate?: string
): Promise<ChildProfile> => {
  const result = await query(
    `INSERT INTO children (parent_id, name, birth_date)
     VALUES ($1, $2, $3)
     RETURNING id, parent_id, name, birth_date, daily_screen_time_limit_minutes, created_at, updated_at`,
    [parentId, name.trim(), birthDate || null]
  );
  const child = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: child.id,
    action: 'CREATE_CHILD',
    resourceType: 'children',
    details: { name: child.name },
  });

  return child;
};

/**
 * Set (or clear, with null) the child's daily screen-time limit in
 * minutes. The Android device never needs to know the limit — the
 * backend evaluates it on every screen-time upload and raises an
 * alert when the day's total crosses it.
 */
export const setScreenTimeLimit = async (
  parentId: string,
  childId: string,
  limitMinutes: number | null
): Promise<ChildProfile> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `UPDATE children
     SET daily_screen_time_limit_minutes = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, parent_id, name, birth_date, daily_screen_time_limit_minutes, created_at, updated_at`,
    [limitMinutes, childId]
  );
  const child = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SET_SCREEN_TIME_LIMIT',
    resourceType: 'children',
    details: { limit_minutes: limitMinutes },
  });

  return child;
};

export interface ChildAlert {
  action: string;
  resource_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

/**
 * Recent security/limit alerts for a child (tamper reports from the
 * device, screen-time limit breaches). Reads the audit log, which is
 * append-only by design — alerts are immutable evidence.
 */
export const listChildAlerts = async (
  parentId: string,
  childId: string,
  limit = 20
): Promise<ChildAlert[]> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `SELECT action, resource_type, details, created_at
     FROM audit_logs
     WHERE target_child_id = $1
       AND action IN ('TAMPER_ALERT', 'SCREEN_TIME_LIMIT_REACHED')
     ORDER BY created_at DESC
     LIMIT $2`,
    [childId, Math.min(limit, 100)]
  );
  return result.rows;
};