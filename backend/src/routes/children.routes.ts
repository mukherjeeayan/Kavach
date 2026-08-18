// children.routes.ts
// Mounted at: /api/v1/children
// Authenticated + parent-only by design.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createChildSchema } from '../dto/child.dto';
import * as childrenController from '../controllers/children.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children — list the parent's child profiles
router.get('/', childrenController.listChildren);

// POST /api/v1/children — create a child profile
router.post('/', validate(createChildSchema), childrenController.createChild);

export default router;