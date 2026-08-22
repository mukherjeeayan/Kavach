import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams } from '../../middleware/params';
import { createConsentSchema, revokeConsentSchema } from './parentalConsent.dto';
import * as consentController from './parentalConsent.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// POST /children/:childId/consent - grant consent
router.post(
  '/:childId/consent',
  validateParams(childAndUuidParams('childId')),
  validate(createConsentSchema),
  consentController.grant
);

// DELETE /children/:childId/consent - revoke consent
router.delete(
  '/:childId/consent',
  validateParams(childAndUuidParams('childId')),
  validate(revokeConsentSchema),
  consentController.revoke
);

// GET /children/:childId/consent - list all consents
router.get(
  '/:childId/consent',
  validateParams(childAndUuidParams('childId')),
  consentController.list
);

// GET /children/:childId/consent/check/:consentType - check if consent is active
router.get(
  '/:childId/consent/check/:consentType',
  validateParams(childAndUuidParams('childId')),
  consentController.check
);

export default router;
