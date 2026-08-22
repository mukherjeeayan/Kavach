// appBlockRule.repository.ts
// DB-only layer — no business logic, all queries parameterized.

import { query } from '../../config/database';
import { AppBlockRule, CreateAppBlockRuleInput } from './AppBlockRule.model';
import { toOffset } from '../../utils/pagination';

/**
 * Verify a device belongs to a child before a rule is attached to it.
 */
export const verifyDeviceBelongsToChild = async (
  deviceId: string,
  childId: string
): Promise<boolean> => {
  const result = await query(`SELECT id FROM devices WHERE id = $1 AND child_id = $2`, [
    deviceId,
    childId,
  ]);
  return result.rows.length > 0;
};

/**
 * Fetch all blocked apps for a given child across all their devices
 * (paginated). Joins through the devices table to scope by child_id.
 */
export const getBlockedAppsByChildId = async (
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: AppBlockRule[]; total: number }> => {
  const count = await query(
    `SELECT COUNT(*)::int AS total
     FROM app_block_rules abr
     INNER JOIN devices d ON abr.device_id = d.id
     WHERE d.child_id = $1`,
    [childId]
  );
  const result = await query(
    `SELECT abr.id, abr.device_id, abr.package_name, abr.app_name,
            abr.is_blocked, abr.block_reason,
            abr.unblock_requested, abr.unblock_reason,
            abr.daily_limit_minutes,
            abr.created_at, abr.updated_at
     FROM app_block_rules abr
     INNER JOIN devices d ON abr.device_id = d.id
     WHERE d.child_id = $1
     ORDER BY abr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );
  // Attach child_id to each row for consistency with the interface
  return {
    items: result.rows.map((row: any) => ({ ...row, child_id: childId })),
    total: count.rows[0].total,
  };
};

/**
 * Create a new app block rule.
 * Uses ON CONFLICT to make the endpoint idempotent — re-blocking
 * an already-blocked package simply updates the existing row.
 */
export const createBlockRule = async (rule: CreateAppBlockRuleInput): Promise<AppBlockRule> => {
  const result = await query(
    `INSERT INTO app_block_rules (device_id, package_name, app_name, is_blocked, block_reason)
     VALUES ($1, $2, $3, true, $4)
     ON CONFLICT (device_id, package_name)
     DO UPDATE SET is_blocked = true,
                   app_name = EXCLUDED.app_name,
                   block_reason = EXCLUDED.block_reason,
                   updated_at = now()
     RETURNING id, device_id, package_name, app_name, is_blocked,
               block_reason, unblock_requested, unblock_reason,
               daily_limit_minutes, created_at, updated_at`,
    [rule.device_id, rule.package_name, rule.app_name || null, rule.block_reason || null]
  );
  return { ...result.rows[0], child_id: rule.child_id };
};

/**
 * Toggle the blocked status of an existing rule.
 */
export const updateBlockStatus = async (
  ruleId: string,
  isBlocked: boolean
): Promise<AppBlockRule | null> => {
  const result = await query(
    `UPDATE app_block_rules
     SET is_blocked = $1, unblock_requested = false, unblock_reason = NULL,
         updated_at = now()
     WHERE id = $2
     RETURNING id, device_id, package_name, app_name, is_blocked,
               block_reason, unblock_requested, unblock_reason,
               daily_limit_minutes, created_at, updated_at`,
    [isBlocked, ruleId]
  );
  return result.rows[0] || null;
};

/**
 * Hard-delete a block rule. Only called after ownership verification
 * in the service layer.
 */
export const deleteBlockRule = async (ruleId: string): Promise<boolean> => {
  const result = await query(
    `DELETE FROM app_block_rules WHERE id = $1`,
    [ruleId]
  );
  return (result.rowCount ?? 0) > 0;
};

/**
 * Fetch all rules where the child has requested an unblock (paginated).
 */
export const getUnblockRequests = async (
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: AppBlockRule[]; total: number }> => {
  const count = await query(
    `SELECT COUNT(*)::int AS total
     FROM app_block_rules abr
     INNER JOIN devices d ON abr.device_id = d.id
     WHERE d.child_id = $1 AND abr.unblock_requested = true`,
    [childId]
  );
  const result = await query(
    `SELECT abr.id, abr.device_id, abr.package_name, abr.app_name,
            abr.is_blocked, abr.block_reason,
            abr.unblock_requested, abr.unblock_reason,
            abr.daily_limit_minutes,
            abr.created_at, abr.updated_at
     FROM app_block_rules abr
     INNER JOIN devices d ON abr.device_id = d.id
     WHERE d.child_id = $1 AND abr.unblock_requested = true
     ORDER BY abr.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );
  return {
    items: result.rows.map((row: any) => ({ ...row, child_id: childId })),
    total: count.rows[0].total,
  };
};

/**
 * Record a child-initiated unblock request on an existing rule.
 */
export const setUnblockRequest = async (
  ruleId: string,
  reason: string
): Promise<AppBlockRule | null> => {
  const result = await query(
    `UPDATE app_block_rules
     SET unblock_requested = true, unblock_reason = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, device_id, package_name, app_name, is_blocked,
               block_reason, unblock_requested, unblock_reason,
               daily_limit_minutes, created_at, updated_at`,
    [reason, ruleId]
  );
  return result.rows[0] || null;
};

/**
 * Verify that a specific rule belongs to a child (used for ownership checks).
 */
export const getRuleByIdAndChildId = async (
  ruleId: string,
  childId: string
): Promise<AppBlockRule | null> => {
  const result = await query(
    `SELECT abr.id, abr.device_id, abr.package_name, abr.app_name,
            abr.is_blocked, abr.block_reason,
            abr.unblock_requested, abr.unblock_reason,
            abr.daily_limit_minutes,
            abr.created_at, abr.updated_at
     FROM app_block_rules abr
     INNER JOIN devices d ON abr.device_id = d.id
     WHERE abr.id = $1 AND d.child_id = $2`,
    [ruleId, childId]
  );
  if (result.rows[0]) {
    return { ...result.rows[0], child_id: childId };
  }
  return null;
};

/**
 * Set (or clear, with null) the per-app daily usage limit of a rule.
 */
export const setDailyLimit = async (
  ruleId: string,
  dailyLimitMinutes: number | null
): Promise<AppBlockRule | null> => {
  const result = await query(
    `UPDATE app_block_rules
     SET daily_limit_minutes = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, device_id, package_name, app_name, is_blocked,
               block_reason, unblock_requested, unblock_reason,
               daily_limit_minutes, created_at, updated_at`,
    [dailyLimitMinutes, ruleId]
  );
  return result.rows[0] || null;
};

/**
 * All rules with an active daily usage cap for a device — the screen
 * time upload path uses these to raise PER_APP_LIMIT_REACHED alerts.
 */
export const getLimitRulesForDevice = async (
  deviceId: string
): Promise<Array<{ id: string; package_name: string; daily_limit_minutes: number }>> => {
  const result = await query(
    `SELECT id, package_name, daily_limit_minutes
     FROM app_block_rules
     WHERE device_id = $1 AND daily_limit_minutes IS NOT NULL`,
    [deviceId]
  );
  return result.rows;
};
