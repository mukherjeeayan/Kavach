import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { deviceIngestionLimiter } from '../../middleware/rateLimiter';
import { locationUploadSchema } from './location.dto';
import { requireConsent } from '../../middleware/consent';
import * as locationController from './location.controller';

const router = Router({ mergeParams: true });

router.post(
  '/:deviceId/location',
  authenticateJWT,
  requireRole('parent'),
  validateParams(uuidParams('deviceId')),
  deviceIngestionLimiter,
  validate(locationUploadSchema),
  requireConsent('location'),
  locationController.upload
);

export default router;
