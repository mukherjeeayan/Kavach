// sos.routes.ts
// Emergency SOS: device trigger + parent management.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams } from '../../middleware/params';
import { requireDeviceOwnership, requireChildOwnership } from '../../middleware/tenantGuard';
import { requireConsent } from '../../middleware/consent';
import { authLimiter } from '../../middleware/rateLimiter';
import { createSosSchema, resolveSosSchema } from './sos.dto';
import * as sosController from './sos.controller';

// ── Device-side route (trigger SOS) ──────────────────────────────
export const sosDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);

  // POST /api/v1/devices/:deviceId/sos
  // Rate-limited to prevent SOS spam — 5 attempts per 15min per device.
  router.post(
    '/:deviceId/sos',
    validateParams(uuidParams('deviceId')),
    requireDeviceOwnership,
    requireConsent('location'),
    validate(createSosSchema),
    authLimiter,
    sosController.createSosEvent
  );

  return router;
})();

// ── Parent-side routes (list, acknowledge, resolve) ──────────────
export const sosParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/sos?status=ACTIVE
  router.get(
    '/:childId/sos',
    validateParams(uuidParams('childId')),
    requireChildOwnership,
    sosController.listSosEvents
  );

  // PUT /api/v1/children/:childId/sos/:eventId/acknowledge
  router.put(
    '/:childId/sos/:eventId/acknowledge',
    validateParams(childAndUuidParams('eventId')),
    requireChildOwnership,
    sosController.acknowledgeSos
  );

  // PUT /api/v1/children/:childId/sos/:eventId/resolve
  router.put(
    '/:childId/sos/:eventId/resolve',
    validateParams(childAndUuidParams('eventId')),
    requireChildOwnership,
    validate(resolveSosSchema),
    sosController.resolveSos
  );

  return router;
})();
