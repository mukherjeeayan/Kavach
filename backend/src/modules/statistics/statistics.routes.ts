// statistics.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { overviewStatsQuery, usageSummaryQuery } from './statistics.dto';
import * as statisticsController from './statistics.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/statistics/overview?period=week|month
router.get(
  '/:childId/statistics/overview',
  validateParams(uuidParams('childId')),
  validateQuery(overviewStatsQuery),
  statisticsController.getOverviewStats
);

// GET /api/v1/children/:childId/statistics/safety-score
router.get(
  '/:childId/statistics/safety-score',
  validateParams(uuidParams('childId')),
  statisticsController.getSafetyScore
);

// GET /api/v1/children/:childId/statistics/usage-summary?period=week|month
router.get(
  '/:childId/statistics/usage-summary',
  validateParams(uuidParams('childId')),
  validateQuery(usageSummaryQuery),
  statisticsController.getUsageSummary
);

// GET /api/v1/children/:childId/statistics/restriction-compliance
router.get(
  '/:childId/statistics/restriction-compliance',
  validateParams(uuidParams('childId')),
  statisticsController.getRestrictionCompliance
);

export default router;
