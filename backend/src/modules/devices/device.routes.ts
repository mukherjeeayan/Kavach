// device.routes.ts
// Mounted at: /api/v1/devices
// Authenticated + parent-only by design.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { requireDeviceOwnership } from '../../middleware/tenantGuard';
import { registerDeviceSchema, adminStatusSchema, fcmTokenSchema, heartbeatSchema, registerPublicKeySchema } from './device.dto';
import * as deviceController from './device.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// POST /api/v1/devices/register — register or refresh a child's device
router.post('/register', validate(registerDeviceSchema), deviceController.registerDevice);

// POST /api/v1/devices/:deviceId/heartbeat — update last_active
router.post('/:deviceId/heartbeat', validateParams(uuidParams('deviceId')), validate(heartbeatSchema), requireDeviceOwnership, deviceController.heartbeat);

// PUT /api/v1/devices/:deviceId/admin-status — report device-admin state
router.put(
  '/:deviceId/admin-status',
  validateParams(uuidParams('deviceId')),
  validate(adminStatusSchema),
  requireDeviceOwnership,
  deviceController.setAdminStatus
);

// PUT /api/v1/devices/:deviceId/fcm-token — refresh the push token
router.put(
  '/:deviceId/fcm-token',
  validateParams(uuidParams('deviceId')),
  validate(fcmTokenSchema),
  requireDeviceOwnership,
  deviceController.updateFcmToken
);

// POST /api/v1/devices/:deviceId/public-key — register device's ECDH public key after QR pairing
router.post(
  '/:deviceId/public-key',
  validateParams(uuidParams('deviceId')),
  validate(registerPublicKeySchema),
  requireDeviceOwnership,
  deviceController.registerPublicKey
);

// DELETE /api/v1/devices/:deviceId — unpair (delete) a device
router.delete('/:deviceId', validateParams(uuidParams('deviceId')), requireDeviceOwnership, deviceController.unpairDevice);

export default router;
