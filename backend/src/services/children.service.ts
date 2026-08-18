// children.service.ts
// Business logic for child profiles. Every operation verifies that
// the child belongs to the authenticated parent before touching data.

import { query } from '../config/database';
import { ForbiddenError } from '../utils/errors';

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
 * List all child profiles for a parent (ordered by creation time).
 */
export const listChildren = async (parentId: string): Promise<ChildProfile[]> => {
  const result = await query(
    `SELECT id, parent_id, name, birth_date, created_at, updated_at
     FROM children
     WHERE parent_id = $1
     ORDER BY created_at ASC`,
    [parentId]
  );
  return result.rows;
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
  return result.rows[0];
};