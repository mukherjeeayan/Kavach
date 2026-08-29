// children.routes.ts
// Mounted at: /api/v1/children
// Authenticated + parent-only by design.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, paginationQuery, childAndUuidParams } from '../../middleware/params';
import { createChildSchema, updateChildSchema, screenTimeLimitSchema, setChildPhoneSchema } from './child.dto';
import * as childrenController from './children.controller';
import * as deviceController from '../devices/device.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children — list the parent's child profiles (paginated)
router.get('/', validateQuery(paginationQuery), childrenController.listChildren);

// POST /api/v1/children — create a child profile
router.post('/', validate(createChildSchema), childrenController.createChild);

// GET /api/v1/children/:childId — fetch a single child profile
router.get('/:childId', validateParams(uuidParams('childId')), childrenController.getChild);

// PATCH /api/v1/children/:childId — update name/birth_date
router.patch(
  '/:childId',
  validateParams(uuidParams('childId')),
  validate(updateChildSchema),
  childrenController.updateChild
);

// DELETE /api/v1/children/:childId — delete profile (DPDP erasure)
router.delete(
  '/:childId',
  validateParams(uuidParams('childId')),
  childrenController.deleteChild
);

// GET /api/v1/children/:childId/devices — list a child's registered devices
router.get(
  '/:childId/devices',
  validateParams(uuidParams('childId')),
  deviceController.listDevicesForChild
);

// PUT /api/v1/children/:childId/screen-time-limit — set/clear daily limit
router.put(
  '/:childId/screen-time-limit',
  validateParams(uuidParams('childId')),
  validate(screenTimeLimitSchema),
  childrenController.setScreenTimeLimit
);

// GET /api/v1/children/:childId/alerts — tamper/limit alerts for the child
router.get(
  '/:childId/alerts',
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  childrenController.listAlerts
);

// POST /api/v1/children/:childId/alerts/ack — mark alerts seen
router.post(
  '/:childId/alerts/ack',
  validateParams(uuidParams('childId')),
  childrenController.acknowledgeAlerts
);

// ── Co-guardian sharing ────────────────────────────────────────────
import { z } from 'zod';

const addGuardianSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
});

router.get(
  '/:childId/guardians',
  validateParams(uuidParams('childId')),
  childrenController.listGuardians
);

router.post(
  '/:childId/guardians',
  validateParams(uuidParams('childId')),
  validate(addGuardianSchema),
  childrenController.addGuardian
);

router.delete(
  '/:childId/guardians/:guardianId',
  validateParams(childAndUuidParams('guardianId')),
  childrenController.removeGuardian
);

// PUT /api/v1/children/:childId/phone — set or clear the child's phone number
router.put(
  '/:childId/phone',
  validateParams(uuidParams('childId')),
  validate(setChildPhoneSchema),
  childrenController.setChildPhone
);

export default router;