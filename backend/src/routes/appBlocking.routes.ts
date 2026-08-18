// appBlocking.routes.ts
// Mounted at: /api/v1/children/:childId/apps
//
// Every route requires JWT authentication.
// Validation middleware runs before the controller on every POST.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { blockAppSchema, requestUnblockSchema } from '../dto/appBlocking.dto';
import * as appBlockingController from '../controllers/appBlocking.controller';

const router = Router({ mergeParams: true }); // mergeParams to access :childId

// All routes require authentication
router.use(authenticateJWT);

// GET  /api/v1/children/:childId/apps/blocked
// Returns all blocked apps for a child
router.get(
  '/blocked',
  requireRole('parent'),
  appBlockingController.getBlockedApps
);

// POST /api/v1/children/:childId/apps/block
// Body: { device_id, package_name, app_name?, block_reason? }
// Creates or re-activates a block rule (idempotent)
router.post(
  '/block',
  requireRole('parent'),
  validate(blockAppSchema),
  appBlockingController.blockApp
);

// DELETE /api/v1/children/:childId/apps/block/:ruleId
// Removes a block rule entirely
router.delete(
  '/block/:ruleId',
  requireRole('parent'),
  appBlockingController.unblockApp
);

// POST /api/v1/children/:childId/apps/block/:ruleId/approve-unblock
// Parent approves a pending unblock request (unblocks the app)
router.post(
  '/block/:ruleId/approve-unblock',
  requireRole('parent'),
  appBlockingController.approveUnblock
);

// POST /api/v1/children/:childId/apps/block/:ruleId/reject-unblock
// Parent rejects a pending unblock request (app stays blocked)
router.post(
  '/block/:ruleId/reject-unblock',
  requireRole('parent'),
  appBlockingController.rejectUnblock
);

// POST /api/v1/children/:childId/apps/unblock-request
// Body: { rule_id, reason }
// Child-initiated request — requires parent approval later.
// Authenticated parents may submit on behalf of their child
// (ownership is verified in the service layer).
router.post(
  '/unblock-request',
  validate(requestUnblockSchema),
  appBlockingController.requestUnblock
);

// GET  /api/v1/children/:childId/apps/unblock-requests
// Returns all pending unblock requests for a child
router.get(
  '/unblock-requests',
  requireRole('parent'),
  appBlockingController.getUnblockRequests
);

export default router;
