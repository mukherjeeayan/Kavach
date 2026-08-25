// communication.routes.ts
// SMS/Call monitoring + keyword alerts.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams } from '../../middleware/params';
import { requireConsent } from '../../middleware/consent';
import { uploadCommunicationsSchema } from './communication.dto';
import * as commController from './communication.controller';

// ── Device-side route (upload communications) ────────────────────
export const communicationDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);

  // POST /api/v1/devices/:deviceId/communications
  router.post(
    '/:deviceId/communications',
    validateParams(uuidParams('deviceId')),
    requireConsent('communications'),
    validate(uploadCommunicationsSchema),
    commController.uploadCommunications
  );

  return router;
})();

// ── Parent-side routes ───────────────────────────────────────────
export const communicationParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/communications?flagged=true&page=1&limit=50
  router.get(
    '/:childId/communications',
    validateParams(uuidParams('childId')),
    commController.listCommunications
  );

  // GET /api/v1/children/:childId/keyword-alerts?unreviewed=true
  router.get(
    '/:childId/keyword-alerts',
    validateParams(uuidParams('childId')),
    commController.listKeywordAlerts
  );

  // PUT /api/v1/children/:childId/keyword-alerts/:alertId/review
  router.put(
    '/:childId/keyword-alerts/:alertId/review',
    validateParams(childAndUuidParams('alertId')),
    commController.reviewKeywordAlert
  );

  return router;
})();
