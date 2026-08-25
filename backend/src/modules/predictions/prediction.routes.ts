// prediction.routes.ts
// Behavior predictions: list active + trigger generation.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import * as predictionController from './prediction.controller';

export const predictionParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/predictions
  router.get(
    '/:childId/predictions',
    validateParams(uuidParams('childId')),
    predictionController.listPredictions
  );

  // POST /api/v1/children/:childId/predictions/generate
  router.post(
    '/:childId/predictions/generate',
    validateParams(uuidParams('childId')),
    predictionController.generatePredictions
  );

  return router;
})();
