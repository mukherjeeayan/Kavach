// communication-log.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { createCommunicationLogSchema } from './communication-log.dto';
import * as commLogController from './communication-log.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/communication-logs?page=1&limit=50
router.get(
  '/:childId/communication-logs',
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  commLogController.listCommunicationLogs
);

// POST /api/v1/children/:childId/communication-logs
router.post(
  '/:childId/communication-logs',
  validateParams(uuidParams('childId')),
  validate(createCommunicationLogSchema),
  commLogController.createCommunicationLog
);

// GET /api/v1/children/:childId/communication-logs/:logId
router.get(
  '/:childId/communication-logs/:logId',
  validateParams(childAndUuidParams('logId')),
  commLogController.getCommunicationLog
);

// DELETE /api/v1/children/:childId/communication-logs/:logId
router.delete(
  '/:childId/communication-logs/:logId',
  validateParams(childAndUuidParams('logId')),
  commLogController.deleteCommunicationLog
);

export default router;
