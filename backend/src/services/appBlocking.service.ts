// appBlocking.service.ts
// All business logic lives here. Framework-agnostic — no req/res objects.
// Throws typed errors that the error-handling middleware translates to HTTP codes.

import * as appBlockRuleRepo from '../repositories/appBlockRule.repository';
import { query } from '../config/database';
import { AppBlockRule } from '../models/AppBlockRule.model';
import logger from '../utils/logger';

// ── Typed Errors ──────────────────────────────────────────────────

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ── Ownership Verification ────────────────────────────────────────
// Security requirement: every operation must first prove that the
// child_id belongs to the authenticated parent_id.  This runs a
// single parameterized query rather than trusting the request body.

export const verifyChildBelongsToParent = async (
  childId: string,
  parentId: string
): Promise<void> => {
  const result = await query(
    `SELECT id FROM children WHERE id = $1 AND parent_id = $2`,
    [childId, parentId]
  );
  if (result.rows.length === 0) {
    throw new ForbiddenError(
      'Child does not belong to the authenticated parent'
    );
  }
};

// ── Service Methods ───────────────────────────────────────────────

/**
 * Block an app for a child.
 * The sync endpoint is idempotent — the device may retry on flaky connections.
 */
export const blockApp = async (
  parentId: string,
  childId: string,
  deviceId: string,
  packageName: string,
  appName?: string,
  reason?: string
): Promise<AppBlockRule> => {
  await verifyChildBelongsToParent(childId, parentId);

  const rule = await appBlockRuleRepo.createBlockRule({
    child_id: childId,
    device_id: deviceId,
    package_name: packageName,
    app_name: appName,
    block_reason: reason,
  });

  logger.info(`App blocked: ${packageName} for child ${childId} by parent ${parentId}`);

  // Write to audit_logs (security skill requirement — every write to
  // child data tables must be audited)
  await query(
    `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      parentId,
      childId,
      'BLOCK_APP',
      'app_block_rules',
      JSON.stringify({ package_name: packageName, device_id: deviceId }),
    ]
  );

  return rule;
};

/**
 * Unblock (delete) an existing block rule.
 */
export const unblockApp = async (
  parentId: string,
  childId: string,
  ruleId: string
): Promise<void> => {
  await verifyChildBelongsToParent(childId, parentId);

  // Verify the rule actually belongs to this child
  const existingRule = await appBlockRuleRepo.getRuleByIdAndChildId(ruleId, childId);
  if (!existingRule) {
    throw new NotFoundError('Block rule not found for this child');
  }

  await appBlockRuleRepo.deleteBlockRule(ruleId);

  logger.info(`App unblocked: rule ${ruleId} for child ${childId} by parent ${parentId}`);

  await query(
    `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      parentId,
      childId,
      'UNBLOCK_APP',
      'app_block_rules',
      JSON.stringify({ rule_id: ruleId, package_name: existingRule.package_name }),
    ]
  );
};

/**
 * Child-initiated unblock request.
 * The caller must be the authenticated parent of the child — this
 * closes the IDOR where any authenticated user could request an
 * unblock on someone else's child.  A future child-role token can
 * call this by binding child_id to its own subject instead.
 */
export const requestUnblock = async (
  parentId: string,
  childId: string,
  ruleId: string,
  reason: string
): Promise<AppBlockRule> => {
  await verifyChildBelongsToParent(childId, parentId);

  const existingRule = await appBlockRuleRepo.getRuleByIdAndChildId(ruleId, childId);
  if (!existingRule) {
    throw new NotFoundError('Block rule not found for this child');
  }

  if (!existingRule.is_blocked) {
    throw new ConflictError('App is not currently blocked');
  }

  if (existingRule.unblock_requested) {
    throw new ConflictError('An unblock request is already pending for this rule');
  }

  const updatedRule = await appBlockRuleRepo.setUnblockRequest(ruleId, reason);
  if (!updatedRule) {
    throw new NotFoundError('Failed to update unblock request');
  }

  logger.info(`Unblock requested: rule ${ruleId} by child ${childId}`);

  return { ...updatedRule, child_id: childId };
};

/**
 * Get all blocked apps for a child.
 */
export const getBlockedApps = async (
  parentId: string,
  childId: string
): Promise<AppBlockRule[]> => {
  await verifyChildBelongsToParent(childId, parentId);
  return appBlockRuleRepo.getBlockedAppsByChildId(childId);
};

/**
 * Parent approves a pending child-initiated unblock request:
 * the rule is unblocked and the request fields cleared.
 */
export const approveUnblock = async (
  parentId: string,
  childId: string,
  ruleId: string
): Promise<AppBlockRule> => {
  await verifyChildBelongsToParent(childId, parentId);

  const existingRule = await appBlockRuleRepo.getRuleByIdAndChildId(ruleId, childId);
  if (!existingRule) {
    throw new NotFoundError('Block rule not found for this child');
  }
  if (!existingRule.unblock_requested) {
    throw new ConflictError('No pending unblock request for this rule');
  }

  const updatedRule = await appBlockRuleRepo.updateBlockStatus(ruleId, false);
  if (!updatedRule) {
    throw new NotFoundError('Failed to approve unblock');
  }

  logger.info(`Unblock approved: rule ${ruleId} for child ${childId} by parent ${parentId}`);

  await query(
    `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      parentId,
      childId,
      'APPROVE_UNBLOCK',
      'app_block_rules',
      JSON.stringify({ rule_id: ruleId, package_name: existingRule.package_name }),
    ]
  );

  return { ...updatedRule, child_id: childId };
};

/**
 * Parent rejects a pending child-initiated unblock request:
 * the rule stays blocked and the request fields are cleared.
 */
export const rejectUnblock = async (
  parentId: string,
  childId: string,
  ruleId: string
): Promise<AppBlockRule> => {
  await verifyChildBelongsToParent(childId, parentId);

  const existingRule = await appBlockRuleRepo.getRuleByIdAndChildId(ruleId, childId);
  if (!existingRule) {
    throw new NotFoundError('Block rule not found for this child');
  }
  if (!existingRule.unblock_requested) {
    throw new ConflictError('No pending unblock request for this rule');
  }

  const updatedRule = await appBlockRuleRepo.updateBlockStatus(ruleId, true);
  if (!updatedRule) {
    throw new NotFoundError('Failed to reject unblock');
  }

  logger.info(`Unblock rejected: rule ${ruleId} for child ${childId} by parent ${parentId}`);

  await query(
    `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      parentId,
      childId,
      'REJECT_UNBLOCK',
      'app_block_rules',
      JSON.stringify({ rule_id: ruleId, package_name: existingRule.package_name }),
    ]
  );

  return { ...updatedRule, child_id: childId };
};

/**
 * Get all pending unblock requests for a child.
 */
export const getUnblockRequests = async (
  parentId: string,
  childId: string
): Promise<AppBlockRule[]> => {
  await verifyChildBelongsToParent(childId, parentId);
  return appBlockRuleRepo.getUnblockRequests(childId);
};
