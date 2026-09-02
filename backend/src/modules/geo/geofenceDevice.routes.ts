// geofenceDevice.routes.ts
// Device-side routes for geofence checking and sync.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { requireDeviceOwnership } from '../../middleware/tenantGuard';
import * as geofenceController from './geofence.controller';

export const geofenceDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // POST /api/v1/devices/:deviceId/geofences/check
  // Checks current location against all active geofences
  router.post(
    '/:deviceId/geofences/check',
    validateParams(uuidParams('deviceId')),
    requireDeviceOwnership,
    geofenceController.checkGeofences
  );

  return router;
})();
