// selfHarm.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { authenticateJWT, requireRole, requirePremium } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { validateQuery } from '../../middleware/validate';
import * as selfHarmController from './selfHarm.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET    /api/v1/children/:childId/self-harm-alerts
router.get(
  '/:childId/self-harm-alerts',
  requirePremium,
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  selfHarmController.listAlerts
);

// PUT    /api/v1/children/:childId/self-harm-alerts/:alertId/acknowledge
router.put(
  '/:childId/self-harm-alerts/:alertId/acknowledge',
  requirePremium,
  validateParams(childAndUuidParams('alertId')),
  selfHarmController.acknowledgeAlert
);

// GET    /api/v1/children/:childId/self-harm-alerts/count
router.get(
  '/:childId/self-harm-alerts/count',
  requirePremium,
  validateParams(uuidParams('childId')),
  selfHarmController.getUnacknowledgedCount
);

export default router;
