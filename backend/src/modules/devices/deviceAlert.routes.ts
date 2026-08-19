// deviceAlert.routes.ts
// Mounted at: /api/v1/devices

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { tamperAlertSchema } from './deviceAlert.dto';
import * as deviceAlertController from './deviceAlert.controller';

const router = Router();

// POST /api/v1/devices/:deviceId/tamper-alert
router.post(
  '/:deviceId/tamper-alert',
  authenticateJWT,
  validateParams(uuidParams('deviceId')),
  validate(tamperAlertSchema),
  deviceAlertController.reportTamper
);

export default router;