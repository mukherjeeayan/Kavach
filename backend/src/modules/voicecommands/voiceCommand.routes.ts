// voiceCommand.routes.ts
// Device-side: record voice command. Parent-side: list commands.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { standardLimiter } from '../../middleware/rateLimiter';
import { recordCommandSchema } from './voiceCommand.dto';
import * as voiceCommandController from './voiceCommand.controller';

// ── Device-side route (record voice command) ──────────────────────
export const voiceCommandDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);

  // POST /api/v1/devices/:deviceId/voice-commands
  // Rate-limited to prevent voice command flooding — 10 attempts per 15min per device.
  router.post(
    '/:deviceId/voice-commands',
    validateParams(uuidParams('deviceId')),
    validate(recordCommandSchema),
    standardLimiter,
    voiceCommandController.recordCommand
  );

  return router;
})();

// ── Parent-side routes (list voice commands) ──────────────────────
export const voiceCommandParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/voice-commands
  router.get(
    '/:childId/voice-commands',
    validateParams(uuidParams('childId')),
    validateQuery(paginationQuery),
    voiceCommandController.listCommands
  );

  return router;
})();
