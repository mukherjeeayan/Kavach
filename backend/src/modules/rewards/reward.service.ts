// reward.service.ts
// Reward catalog, points tracking, and redemptions.
// Parent manages catalog and awards points; child browses and redeems.

import { query } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

export interface RewardCatalogInput {
  name: string;
  description?: string;
  cost_points: number;
  icon?: string;
}

export interface AwardPointsInput {
  child_id: string;
  points: number;
  reason?: string;
  source?: string;
}

export interface RedeemRewardInput {
  reward_id: string;
}

const CATALOG_COLUMNS =
  'id, parent_id, name, description, cost_points, icon, is_active, created_at';
const POINT_COLUMNS = 'id, child_id, points, reason, source, created_at';
const REDEMPTION_COLUMNS =
  'id, child_id, reward_id, points_spent, status, parent_notes, redeemed_at, resolved_at';

// ─── Catalog CRUD (parent-managed) ──────────────────────────────

export const listCatalog = async (
  parentId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  const count = await query(
    `SELECT COUNT(*)::int AS total FROM reward_catalog WHERE parent_id = $1`,
    [parentId]
  );

  const result = await query(
    `SELECT ${CATALOG_COLUMNS}
     FROM reward_catalog
     WHERE parent_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [parentId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};

export const createCatalogItem = async (
  parentId: string,
  input: RewardCatalogInput
) => {
  const result = await query(
    `INSERT INTO reward_catalog (parent_id, name, description, cost_points, icon)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CATALOG_COLUMNS}`,
    [parentId, input.name, input.description ?? null, input.cost_points, input.icon ?? null]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'REWARD_CATALOG_CREATED',
    resourceType: 'reward_catalog',
    details: { reward_id: result.rows[0].id, name: input.name, cost_points: input.cost_points },
  });

  return result.rows[0];
};

export const updateCatalogItem = async (
  parentId: string,
  rewardId: string,
  input: Partial<RewardCatalogInput>
) => {
  const result = await query(
    `UPDATE reward_catalog
     SET name = COALESCE($3, name),
         description = COALESCE($4, description),
         cost_points = COALESCE($5, cost_points),
         icon = COALESCE($6, icon),
         is_active = COALESCE($7, is_active)
     WHERE id = $1 AND parent_id = $2
     RETURNING ${CATALOG_COLUMNS}`,
    [
      rewardId,
      parentId,
      input.name ?? null,
      input.description ?? null,
      input.cost_points ?? null,
      input.icon ?? null,
      (input as Record<string, unknown>).is_active ?? null,
    ]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Reward catalog item not found');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'REWARD_CATALOG_UPDATED',
    resourceType: 'reward_catalog',
    details: { reward_id: rewardId },
  });

  return result.rows[0];
};

export const deleteCatalogItem = async (
  parentId: string,
  rewardId: string
) => {
  const result = await query(
    `DELETE FROM reward_catalog WHERE id = $1 AND parent_id = $2`,
    [rewardId, parentId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Reward catalog item not found');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'REWARD_CATALOG_DELETED',
    resourceType: 'reward_catalog',
    details: { reward_id: rewardId },
  });
};

// ─── Points Management ──────────────────────────────────────────

export const awardPoints = async (
  parentId: string,
  childId: string,
  input: AwardPointsInput
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `INSERT INTO reward_points (child_id, points, reason, source)
     VALUES ($1, $2, $3, $4)
     RETURNING ${POINT_COLUMNS}`,
    [childId, input.points, input.reason ?? null, input.source ?? null]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'POINTS_AWARDED',
    resourceType: 'reward_points',
    details: { points: input.points, reason: input.reason },
  });

  return result.rows[0];
};

export const getPointsBalance = async (
  parentId: string,
  childId: string
): Promise<number> => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT COALESCE(SUM(points), 0)::int AS balance
     FROM reward_points
     WHERE child_id = $1`,
    [childId]
  );
  return result.rows[0].balance;
};

export const listPointsLedger = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const count = await query(
    `SELECT COUNT(*)::int AS total FROM reward_points WHERE child_id = $1`,
    [childId]
  );

  const result = await query(
    `SELECT ${POINT_COLUMNS}
     FROM reward_points
     WHERE child_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};

// ─── Redemptions ────────────────────────────────────────────────

/**
 * Browse active catalog items (child view).
 */
export const browseCatalog = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  // We need the parent who owns the catalog items for this child
  const child = await query(`SELECT parent_id FROM children WHERE id = $1`, [childId]);
  const catalogParentId = child.rows[0]?.parent_id;

  const count = await query(
    `SELECT COUNT(*)::int AS total FROM reward_catalog WHERE parent_id = $1 AND is_active = TRUE`,
    [catalogParentId]
  );

  const result = await query(
    `SELECT ${CATALOG_COLUMNS}
     FROM reward_catalog
     WHERE parent_id = $1 AND is_active = TRUE
     ORDER BY cost_points ASC
     LIMIT $2 OFFSET $3`,
    [catalogParentId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};

/**
 * Child redeems a reward (deducts points, creates redemption record).
 */
export const redeemReward = async (
  parentId: string,
  childId: string,
  input: RedeemRewardInput
) => {
  await verifyChildBelongsToParent(childId, parentId);

  // Get the reward item
  const child = await query(`SELECT parent_id FROM children WHERE id = $1`, [childId]);
  const catalogParentId = child.rows[0]?.parent_id;

  const reward = await query(
    `SELECT * FROM reward_catalog
     WHERE id = $1 AND parent_id = $2 AND is_active = TRUE`,
    [input.reward_id, catalogParentId]
  );
  if (reward.rows.length === 0) {
    throw new NotFoundError('Reward not found or inactive');
  }

  const cost = reward.rows[0].cost_points;

  // Check balance
  const balanceResult = await query(
    `SELECT COALESCE(SUM(points), 0)::int AS balance FROM reward_points WHERE child_id = $1`,
    [childId]
  );
  if (balanceResult.rows[0].balance < cost) {
    throw new ForbiddenError('Insufficient points to redeem this reward');
  }

  // Deduct points (negative entry)
  await query(
    `INSERT INTO reward_points (child_id, points, reason, source)
     VALUES ($1, $2, $3, 'REDEMPTION')`,
    [childId, -cost, `Redeemed: ${reward.rows[0].name}`]
  );

  // Create redemption record
  const redemption = await query(
    `INSERT INTO reward_redemptions (child_id, reward_id, points_spent)
     VALUES ($1, $2, $3)
     RETURNING ${REDEMPTION_COLUMNS}`,
    [childId, input.reward_id, cost]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'REWARD_REDEEMED',
    resourceType: 'reward_redemptions',
    details: {
      redemption_id: redemption.rows[0].id,
      reward_id: input.reward_id,
      points_spent: cost,
    },
  });

  return redemption.rows[0];
};

/**
 * Parent resolves a redemption (approve/reject/fulfill).
 */
export const resolveRedemption = async (
  parentId: string,
  childId: string,
  redemptionId: string,
  status: 'APPROVED' | 'REJECTED' | 'FULFILLED',
  parentNotes?: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `UPDATE reward_redemptions
     SET status = $3,
         parent_notes = COALESCE($4, parent_notes),
         resolved_at = now()
     WHERE id = $1 AND child_id = $2
     RETURNING ${REDEMPTION_COLUMNS}`,
    [redemptionId, childId, status, parentNotes ?? null]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Redemption not found for this child');
  }

  // If rejected, refund points
  if (status === 'REJECTED') {
    const redemption = result.rows[0];
    await query(
      `INSERT INTO reward_points (child_id, points, reason, source)
       VALUES ($1, $2, $3, 'REFUND')`,
      [childId, redemption.points_spent, `Refund: rejected redemption ${redemptionId}`]
    );
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: `REDEMPTION_${status}`,
    resourceType: 'reward_redemptions',
    details: { redemption_id: redemptionId, status, parent_notes: parentNotes },
  });

  return result.rows[0];
};

/**
 * List redemptions (parent view).
 */
export const listRedemptions = async (
  parentId: string,
  childId: string,
  status?: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const params: unknown[] = [childId];
  let whereClause = 'WHERE r.child_id = $1';

  if (status) {
    params.push(status);
    whereClause += ` AND r.status = $${params.length}`;
  }

  const count = await query(
    `SELECT COUNT(*)::int AS total FROM reward_redemptions r ${whereClause}`,
    params
  );

  const result = await query(
    `SELECT r.${REDEMPTION_COLUMNS.replace(/,\s*/g, ', r.')},
            rc.name AS reward_name, rc.icon AS reward_icon
     FROM reward_redemptions r
     JOIN reward_catalog rc ON rc.id = r.reward_id
     ${whereClause}
     ORDER BY r.redeemed_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};
