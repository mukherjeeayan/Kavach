// alerts.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { alertsQuerySchema } from './alerts.dto';
import * as alertsController from './alerts.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

const childIdParams = z.object({ childId: z.string().uuid() });
const childAndAlertParams = z.object({ childId: z.string().uuid(), alertId: z.string().uuid() });

// GET /api/v1/children/:childId/alerts
router.get(
  '/:childId/alerts',
  validateParams(childIdParams),
  validateQuery(alertsQuerySchema),
  alertsController.getAlerts
);

// PATCH /api/v1/children/:childId/alerts/:alertId/read
router.patch(
  '/:childId/alerts/:alertId/read',
  validateParams(childAndAlertParams),
  alertsController.markAsRead
);

// DELETE /api/v1/children/:childId/alerts/:alertId
router.delete(
  '/:childId/alerts/:alertId',
  validateParams(childAndAlertParams),
  alertsController.deleteAlert
);

export default router;
