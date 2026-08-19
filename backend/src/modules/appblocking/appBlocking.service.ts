// appBlocking.service.ts
// All business logic lives here. Framework-agnostic — no req/res objects.
// Throws typed errors that the error-handling middleware translates to HTTP codes.

import * as appBlockRuleRepo from './appBlockRule.repository';
import { AppBlockRule } from './AppBlockRule.model';
import logger from '../../utils/logger';
import { NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors';
import { writeAuditLog } from '../shared/audit.service';

// ── Typed Errors ──────────────────────────────────────────────────
// Defined centrally in utils/errors.ts; re-exported here so existing
// callers (tests included) keep importing them from this module.

export {
  NotFoundError,
  ForbiddenError,
  ConflictError,
};

// ── Ownership Verification ────────────────────────────────────────
// Security requirement: every operation must first prove that the
// child_id belongs to the authenticated parent_id. Shared with the
// children/device services — re-exported here so callers (tests
// included) keep importing it from this module.

import { verifyChildBelongsToParent } from '../children/children.service';

export { verifyChildBelongsToParent };

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

  // Never attach a rule to a device that does not belong to this child.
  const deviceOwned = await appBlockRuleRepo.verifyDeviceBelongsToChild(deviceId, childId);
  if (!deviceOwned) {
    throw new NotFoundError('Device not found for this child');
  }

  const rule = await appBlockRuleRepo.createBlockRule({
    child_id: childId,
    device_id: deviceId,
    package_name: packageName,
    app_name: appName,
    block_reason: reason,
  });

  logger.info(`App blocked: ${packageName} for child ${childId} by parent ${parentId}`);

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'BLOCK_APP',
    resourceType: 'app_block_rules',
    details: { package_name: packageName, device_id: deviceId },
  });

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

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'UNBLOCK_APP',
    resourceType: 'app_block_rules',
    details: { rule_id: ruleId, package_name: existingRule.package_name },
  });
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

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'REQUEST_UNBLOCK',
    resourceType: 'app_block_rules',
    details: { rule_id: ruleId, package_name: existingRule.package_name, reason },
  });

  return { ...updatedRule, child_id: childId };
};

/**
 * Get all blocked apps for a child (paginated).
 */
export const getBlockedApps = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: AppBlockRule[]; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);
  return appBlockRuleRepo.getBlockedAppsByChildId(childId, page, limit);
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

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'APPROVE_UNBLOCK',
    resourceType: 'app_block_rules',
    details: { rule_id: ruleId, package_name: existingRule.package_name },
  });

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

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'REJECT_UNBLOCK',
    resourceType: 'app_block_rules',
    details: { rule_id: ruleId, package_name: existingRule.package_name },
  });

  return { ...updatedRule, child_id: childId };
};

/**
 * Get all pending unblock requests for a child (paginated).
 */
export const getUnblockRequests = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: AppBlockRule[]; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);
  return appBlockRuleRepo.getUnblockRequests(childId, page, limit);
};
