// deviceAlert.routes.ts
// Mounted at: /api/v1/devices

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { tamperAlertSchema } from './deviceAlert.dto';
import * as deviceAlertController from './deviceAlert.controller';

const router = Router();

// POST /api/v1/devices/:deviceId/tamper-alert
router.post(
  '/:deviceId/tamper-alert',
  authenticateJWT,
  validate(tamperAlertSchema),
  deviceAlertController.reportTamper
);

export default router;