// security.routes.ts
// Security scans and WiFi monitoring: device upload + parent read.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams } from '../../middleware/params';
import { requireConsent } from '../../middleware/consent';
import { createSecurityScanSchema, createWifiLogSchema } from './security.dto';
import * as securityController from './security.controller';

// ── Device-side routes (record scans + WiFi) ────────────────────
export const securityDeviceRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);

  // POST /api/v1/devices/:deviceId/security-scans
  router.post(
    '/:deviceId/security-scans',
    validateParams(uuidParams('deviceId')),
    requireConsent('app_usage'),
    validate(createSecurityScanSchema),
    securityController.recordSecurityScan
  );

  // POST /api/v1/devices/:deviceId/wifi-logs
  router.post(
    '/:deviceId/wifi-logs',
    validateParams(uuidParams('deviceId')),
    requireConsent('app_usage'),
    validate(createWifiLogSchema),
    securityController.recordWifiLog
  );

  return router;
})();

// ── Parent-side routes (list scans + WiFi logs) ─────────────────
export const securityParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/children/:childId/devices/:deviceId/security-scans
  router.get(
    '/:childId/devices/:deviceId/security-scans',
    validateParams(childAndUuidParams('deviceId')),
    securityController.listSecurityScans
  );

  // GET /api/v1/children/:childId/devices/:deviceId/wifi-logs
  router.get(
    '/:childId/devices/:deviceId/wifi-logs',
    validateParams(childAndUuidParams('deviceId')),
    securityController.listWifiLogs
  );

  return router;
})();
