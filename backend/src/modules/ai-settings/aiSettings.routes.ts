// aiSettings.routes.ts
// Routes for managing user AI provider settings.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { upsertAiSettingsSchema } from './aiSettings.dto';
import * as aiSettingsController from './aiSettings.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/ai/settings — list configured providers
router.get('/settings', aiSettingsController.getSettings);

// PUT /api/v1/ai/settings — create or update provider config
router.put('/settings', validate(upsertAiSettingsSchema), aiSettingsController.upsertSettings);

// DELETE /api/v1/ai/settings/:provider — remove provider config
router.delete('/settings/:provider', aiSettingsController.deleteSettings);

// POST /api/v1/ai/test — test provider connection
router.post('/test', aiSettingsController.testConnection);

// POST /api/v1/ai/models/fetch — fetch available models from provider
router.post('/models/fetch', aiSettingsController.fetchModels);

export default router;
