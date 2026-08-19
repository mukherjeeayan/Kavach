// locks.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)
// All routes require a parent JWT.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { createLockSchema, updateLockSchema } from './locks.dto';
import * as locksController from './locks.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET    /api/v1/children/:childId/locks
router.get(
  '/:childId/locks',
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  locksController.listLocks
);

// POST   /api/v1/children/:childId/locks
router.post(
  '/:childId/locks',
  validateParams(uuidParams('childId')),
  validate(createLockSchema),
  locksController.createLock
);

// PUT    /api/v1/children/:childId/locks/:lockId
router.put(
  '/:childId/locks/:lockId',
  validateParams(childAndUuidParams('lockId')),
  validate(updateLockSchema),
  locksController.updateLock
);

// DELETE /api/v1/children/:childId/locks/:lockId
router.delete(
  '/:childId/locks/:lockId',
  validateParams(childAndUuidParams('lockId')),
  locksController.deleteLock
);

export default router;
