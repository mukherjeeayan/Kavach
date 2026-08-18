// device.routes.ts
// Mounted at: /api/v1/devices
// Authenticated + parent-only by design.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { registerDeviceSchema } from './device.dto';
import * as deviceController from './device.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// POST /api/v1/devices/register — register or refresh a child's device
router.post('/register', validate(registerDeviceSchema), deviceController.registerDevice);

// POST /api/v1/devices/:deviceId/heartbeat — update last_active
router.post('/:deviceId/heartbeat', deviceController.heartbeat);

export default router;