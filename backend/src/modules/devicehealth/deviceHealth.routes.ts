// deviceHealth.routes.ts
// Device health: upload from device, read from parent dashboard.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams } from '../../middleware/params';
import { requireDeviceOwnership, requireChildOwnership } from '../../middleware/tenantGuard';
import { requireConsent } from '../../middleware/consent';
import { recordHealthSchema } from './deviceHealth.dto';
import * as deviceHealthController from './deviceHealth.controller';

// ── Device-side route (POST health snapshot) ──────────────────────
export const deviceHealthDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);

  // POST /api/v1/devices/:deviceId/health
  router.post(
    '/:deviceId/health',
    validateParams(uuidParams('deviceId')),
    requireDeviceOwnership,
    requireConsent('app_usage'),
    validate(recordHealthSchema),
    deviceHealthController.recordHealth
  );
  return router;
})();

// ── Parent-side routes (read health) ──────────────────────────────
export const deviceHealthParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/devices/:deviceId/health
  router.get(
    '/:childId/devices/:deviceId/health',
    validateParams(childAndUuidParams('deviceId')),
    requireChildOwnership,
    deviceHealthController.getLatestHealth
  );

  // GET /api/v1/children/:childId/devices/:deviceId/health/history
  router.get(
    '/:childId/devices/:deviceId/health/history',
    validateParams(childAndUuidParams('deviceId')),
    requireChildOwnership,
    deviceHealthController.getHealthHistory
  );

  return router;
})();
