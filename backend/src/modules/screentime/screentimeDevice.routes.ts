// screentimeDevice.routes.ts
// Mounted at: /api/v1/devices
// POST /devices/:deviceId/screen-time — batch upload from the app.

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { screenTimeUploadSchema } from './screentime.dto';
import * as screentimeController from './screentime.controller';

const router = Router({ mergeParams: true });

router.post(
  '/:deviceId/screen-time',
  authenticateJWT,
  validate(screenTimeUploadSchema),
  screentimeController.upload
);

export default router;
