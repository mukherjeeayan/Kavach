// reports.routes.ts
// Mounted at: /api/v1/reports

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { reportsQuerySchema } from './reports.dto';
import { validateQuery } from '../../middleware/validate';
import * as reportsController from './reports.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/reports/safety?childId=xxx&period=week|month
router.get('/safety', validateQuery(reportsQuerySchema), reportsController.getSafetyReport);

// GET /api/v1/reports/location?childId=xxx&period=week|month
router.get('/location', validateQuery(reportsQuerySchema), reportsController.getLocationReport);

// GET /api/v1/reports/usage?childId=xxx&period=week|month
router.get('/usage', validateQuery(reportsQuerySchema), reportsController.getUsageReport);

// GET /api/v1/reports/communication?childId=xxx&period=week|month
router.get('/communication', validateQuery(reportsQuerySchema), reportsController.getCommunicationReport);

export default router;
