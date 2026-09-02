import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { requireDeviceOwnership } from '../../middleware/tenantGuard';
import { tamperAlertSchema } from './deviceAlert.dto';
import * as deviceAlertController from './deviceAlert.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// POST /api/v1/devices/:deviceId/tamper-alert
router.post(
  '/:deviceId/tamper-alert',
  validateParams(uuidParams('deviceId')),
  requireDeviceOwnership,
  validate(tamperAlertSchema),
  deviceAlertController.reportTamper
);

export default router;
