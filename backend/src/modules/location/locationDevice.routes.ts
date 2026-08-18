// locationDevice.routes.ts
// Mounted at: /api/v1/devices
// POST /devices/:deviceId/location — GPS ping from the app.

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { locationUploadSchema } from './location.dto';
import * as locationController from './location.controller';

const router = Router({ mergeParams: true });

router.post(
  '/:deviceId/location',
  authenticateJWT,
  validate(locationUploadSchema),
  locationController.upload
);

export default router;
