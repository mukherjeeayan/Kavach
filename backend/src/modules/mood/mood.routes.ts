// mood.routes.ts
// Mood tracking: device self-report + parent read/summary.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, paginationQuery } from '../../middleware/params';
import { requireConsent } from '../../middleware/consent';
import { createMoodLogSchema } from './mood.dto';
import * as moodController from './mood.controller';

// ── Device-side route (child self-reports mood) ─────────────────
export const moodDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);

  // POST /api/v1/devices/:deviceId/mood
  router.post(
    '/:deviceId/mood',
    validateParams(uuidParams('deviceId')),
    requireConsent('mental_health'),
    validate(createMoodLogSchema),
    moodController.createMoodLog
  );

  return router;
})();

// ── Parent-side routes (list logs, summary) ─────────────────────
export const moodParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/mood?page=1&limit=20
  router.get(
    '/:childId/mood',
    validateParams(uuidParams('childId')),
    validateQuery(paginationQuery),
    moodController.listMoodLogs
  );

  // GET /api/v1/children/:childId/mood/summary
  router.get(
    '/:childId/mood/summary',
    validateParams(uuidParams('childId')),
    moodController.getMoodSummary
  );

  return router;
})();
