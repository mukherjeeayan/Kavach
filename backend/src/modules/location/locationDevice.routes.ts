// locationDevice.routes.ts
// Mounted at: /api/v1/devices
// POST /devices/:deviceId/location — GPS ping from the app.

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { deviceIngestionLimiter } from '../../middleware/rateLimiter';
import { locationUploadSchema } from './location.dto';
import * as locationController from './location.controller';

const router = Router({ mergeParams: true });

router.post(
  '/:deviceId/location',
  authenticateJWT,
  validateParams(uuidParams('deviceId')),
  deviceIngestionLimiter,
  validate(locationUploadSchema),
  locationController.upload
);

export default router;
