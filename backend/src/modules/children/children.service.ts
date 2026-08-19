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
    `SELECT id, parent_id, name, birth_date, created_at, updated_at
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
     RETURNING id, parent_id, name, birth_date, created_at, updated_at`,
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