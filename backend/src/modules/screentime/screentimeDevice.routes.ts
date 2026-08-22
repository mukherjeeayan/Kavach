import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { deviceIngestionLimiter } from '../../middleware/rateLimiter';
import { screenTimeUploadSchema } from './screentime.dto';
import { requireConsent } from '../../middleware/consent';
import * as screentimeController from './screentime.controller';

const router = Router({ mergeParams: true });

router.post(
  '/:deviceId/screen-time',
  authenticateJWT,
  requireRole('parent'),
  validateParams(uuidParams('deviceId')),
  deviceIngestionLimiter,
  validate(screenTimeUploadSchema),
  requireConsent('app_usage'),
  screentimeController.upload
);

export default router;
