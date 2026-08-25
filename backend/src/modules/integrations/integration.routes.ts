// integration.routes.ts
// Mounted at: /api/v1/integrations

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { createIntegrationSchema, updateIntegrationSchema } from './integration.dto';
import * as integrationController from './integration.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET    /api/v1/integrations
router.get(
  '/',
  integrationController.listIntegrations
);

// POST   /api/v1/integrations
router.post(
  '/',
  validate(createIntegrationSchema),
  integrationController.createIntegration
);

// PUT    /api/v1/integrations/:integrationId
router.put(
  '/:integrationId',
  validateParams(uuidParams('integrationId')),
  validate(updateIntegrationSchema),
  integrationController.updateIntegration
);

// DELETE /api/v1/integrations/:integrationId
router.delete(
  '/:integrationId',
  validateParams(uuidParams('integrationId')),
  integrationController.deleteIntegration
);

// POST   /api/v1/integrations/:integrationId/sync
router.post(
  '/:integrationId/sync',
  validateParams(uuidParams('integrationId')),
  integrationController.syncIntegration
);

export default router;
