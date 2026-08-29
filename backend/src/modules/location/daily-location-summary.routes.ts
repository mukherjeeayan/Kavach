// daily-location-summary.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import * as dailyLocController from './daily-location-summary.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/daily-location-summary?date=YYYY-MM-DD
router.get(
  '/:childId/daily-location-summary',
  validateParams(uuidParams('childId')),
  dailyLocController.getDailySummary
);

// GET /api/v1/children/:childId/daily-location-summary/list?startDate=xxx&endDate=xxx
router.get(
  '/:childId/daily-location-summary/list',
  validateParams(uuidParams('childId')),
  dailyLocController.getDailySummaryList
);

export default router;
