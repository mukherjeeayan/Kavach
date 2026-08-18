// location.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)
// Parent-facing read routes.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import * as locationController from './location.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/locations/current
router.get('/:childId/locations/current', locationController.getCurrent);

// GET /api/v1/children/:childId/locations/history?from&to&limit
router.get('/:childId/locations/history', locationController.getHistory);

export default router;
