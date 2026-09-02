// appBlocking.routes.ts
// Mounted at: /api/v1/children/:childId/apps
//
// Every route requires JWT authentication.
// Validation middleware runs before the controller on every POST.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { blockAppSchema, requestUnblockSchema, dailyLimitSchema } from './appBlocking.dto';
import * as appBlockingController from './appBlocking.controller';

const router = Router({ mergeParams: true }); // mergeParams to access :childId

// All routes require authentication
router.use(authenticateJWT);

// GET  /api/v1/children/:childId/apps/blocked
// Returns all blocked apps for a child (paginated)
router.get(
  '/blocked',
  requireRole('parent'),
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  appBlockingController.getBlockedApps
);

// POST /api/v1/children/:childId/apps/block
// Body: { device_id, package_name, app_name?, block_reason? }
// Creates or re-activates a block rule (idempotent)
router.post(
  '/block',
  requireRole('parent'),
  validateParams(uuidParams('childId')),
  validate(blockAppSchema),
  appBlockingController.blockApp
);

// DELETE /api/v1/children/:childId/apps/block/:ruleId
// Removes a block rule entirely
router.delete(
  '/block/:ruleId',
  requireRole('parent'),
  validateParams(childAndUuidParams('ruleId')),
  appBlockingController.unblockApp
);

// POST /api/v1/children/:childId/apps/block/:ruleId/approve-unblock
// Parent approves a pending unblock request (unblocks the app)
router.post(
  '/block/:ruleId/approve-unblock',
  requireRole('parent'),
  validateParams(childAndUuidParams('ruleId')),
  appBlockingController.approveUnblock
);

// POST /api/v1/children/:childId/apps/block/:ruleId/reject-unblock
// Parent rejects a pending unblock request (app stays blocked)
router.post(
  '/block/:ruleId/reject-unblock',
  requireRole('parent'),
  validateParams(childAndUuidParams('ruleId')),
  appBlockingController.rejectUnblock
);

// PUT /api/v1/children/:childId/apps/block/:ruleId/limit
// Body: { daily_limit_minutes: number | null }
// Sets or clears the per-app daily usage cap.
router.put(
  '/block/:ruleId/limit',
  requireRole('parent'),
  validateParams(childAndUuidParams('ruleId')),
  validate(dailyLimitSchema),
  appBlockingController.setAppDailyLimit
);

// POST /api/v1/children/:childId/apps/unblock-request
// Body: { rule_id, reason }
// Child-initiated request — requires parent approval later.
// Authenticated parents may submit on behalf of their child
// (ownership is verified in the service layer).
router.post(
  '/unblock-request',
  requireRole('parent'),
  validateParams(uuidParams('childId')),
  validate(requestUnblockSchema),
  appBlockingController.requestUnblock
);

// GET  /api/v1/children/:childId/apps/unblock-requests
// Returns all pending unblock requests for a child (paginated)
router.get(
  '/unblock-requests',
  requireRole('parent'),
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  appBlockingController.getUnblockRequests
);

// POST /api/v1/children/:childId/apps/unblock-requests/:requestId/respond
// Parent approves or denies an unblock request
router.post(
  '/unblock-requests/:requestId/respond',
  requireRole('parent'),
  validateParams(childAndUuidParams('requestId')),
  appBlockingController.respondToUnblockRequest
);

export default router;
