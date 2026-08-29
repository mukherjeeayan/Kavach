// geofence.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { createGeofenceSchema, updateGeofenceSchema, checkGeofenceSchema } from './geofence.dto';
import * as geofenceController from './geofence.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/geofences
router.get(
  '/:childId/geofences',
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  geofenceController.listGeofences
);

// POST /api/v1/children/:childId/geofences
router.post(
  '/:childId/geofences',
  validateParams(uuidParams('childId')),
  validate(createGeofenceSchema),
  geofenceController.createGeofence
);

// POST /api/v1/children/:childId/geofences/check
router.post(
  '/:childId/geofences/check',
  validateParams(uuidParams('childId')),
  validate(checkGeofenceSchema),
  geofenceController.checkGeofencesForChild
);

// PUT /api/v1/children/:childId/geofences/:geofenceId
router.put(
  '/:childId/geofences/:geofenceId',
  validateParams(childAndUuidParams('geofenceId')),
  validate(updateGeofenceSchema),
  geofenceController.updateGeofence
);

// DELETE /api/v1/children/:childId/geofences/:geofenceId
router.delete(
  '/:childId/geofences/:geofenceId',
  validateParams(childAndUuidParams('geofenceId')),
  geofenceController.deleteGeofence
);

export default router;
