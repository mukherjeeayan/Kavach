// analytics.routes.ts
// Parent-side analytics report generation and retrieval.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { generateReportSchema } from './analytics.dto';
import * as analyticsController from './analytics.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// POST /api/v1/children/:childId/reports/generate
router.post(
  '/:childId/reports/generate',
  validateParams(uuidParams('childId')),
  validate(generateReportSchema),
  analyticsController.generateReport
);

// GET /api/v1/children/:childId/reports/latest?type=WEEKLY|MONTHLY
router.get(
  '/:childId/reports/latest',
  validateParams(uuidParams('childId')),
  analyticsController.getCachedReport
);

// GET /api/v1/children/:childId/reports
router.get(
  '/:childId/reports',
  validateParams(uuidParams('childId')),
  analyticsController.listReports
);

export default router;
