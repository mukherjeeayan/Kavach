// appBlocking.routes.ts
// Mounted at: /api/v1/children/:childId/apps
//
// Every route requires JWT authentication.
// Validation middleware runs before the controller on every POST.

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
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
  appBlockingController.getBlockedApps
);

// POST /api/v1/children/:childId/apps/block
// Body: { device_id, package_name, app_name?, block_reason? }
// Creates or re-activates a block rule (idempotent)
router.post(
  '/block',
  validate(blockAppSchema),
  appBlockingController.blockApp
);

// DELETE /api/v1/children/:childId/apps/block/:ruleId
// Removes a block rule entirely
router.delete(
  '/block/:ruleId',
  appBlockingController.unblockApp
);

// POST /api/v1/children/:childId/apps/unblock-request
// Body: { rule_id, reason }
// Child-initiated request — requires parent approval later
router.post(
  '/unblock-request',
  validate(requestUnblockSchema),
  appBlockingController.requestUnblock
);

// GET  /api/v1/children/:childId/apps/unblock-requests
// Returns all pending unblock requests for a child
router.get(
  '/unblock-requests',
  appBlockingController.getUnblockRequests
);

export default router;
