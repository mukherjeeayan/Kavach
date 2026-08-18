// children.routes.ts
// Mounted at: /api/v1/children
// Authenticated + parent-only by design.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createChildSchema } from './child.dto';
import * as childrenController from './children.controller';
import * as deviceController from '../devices/device.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children — list the parent's child profiles
router.get('/', childrenController.listChildren);

// POST /api/v1/children — create a child profile
router.post('/', validate(createChildSchema), childrenController.createChild);

// GET /api/v1/children/:childId/devices — list a child's registered devices
router.get('/:childId/devices', deviceController.listDevicesForChild);

export default router;