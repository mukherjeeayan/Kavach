// settings.routes.ts
// Mounted at: /api/v1/settings

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateSettingsSchema, pushTokenSchema } from './settings.dto';
import * as settingsController from './settings.controller';

const router = Router();

router.use(authenticateJWT);

// GET /api/v1/settings
router.get('/', settingsController.getSettings);

// PUT /api/v1/settings
router.put('/', validate(updateSettingsSchema), settingsController.updateSettings);

// POST /api/v1/settings/push-token
router.post('/push-token', validate(pushTokenSchema), settingsController.savePushToken);

export default router;
