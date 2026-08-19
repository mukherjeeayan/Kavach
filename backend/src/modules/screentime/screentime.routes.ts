// screentime.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)
// All routes require a parent JWT.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, dateQuery, screenTimeSummaryQuery } from '../../middleware/params';
import { screenTimeUploadSchema } from './screentime.dto';
import * as screentimeController from './screentime.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/screen-time?date=YYYY-MM-DD
router.get(
  '/:childId/screen-time',
  validateParams(uuidParams('childId')),
  validateQuery(dateQuery),
  screentimeController.getDaily
);

// GET /api/v1/children/:childId/screen-time/summary?range=day|week|month
router.get(
  '/:childId/screen-time/summary',
  validateParams(uuidParams('childId')),
  validateQuery(screenTimeSummaryQuery),
  screentimeController.getSummary
);

export default router;

// Device-scoped upload route is mounted under /api/v1/devices — see
// screentimeDevice.routes.ts.
