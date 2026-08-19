// contacts.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)
// All routes require a parent JWT.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import { createContactSchema, updateContactSchema } from './contacts.dto';
import * as contactsController from './contacts.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET    /api/v1/children/:childId/contacts
router.get(
  '/:childId/contacts',
  validateParams(uuidParams('childId')),
  validateQuery(paginationQuery),
  contactsController.listContacts
);

// POST   /api/v1/children/:childId/contacts
router.post(
  '/:childId/contacts',
  validateParams(uuidParams('childId')),
  validate(createContactSchema),
  contactsController.createContact
);

// PUT    /api/v1/children/:childId/contacts/:contactId
router.put(
  '/:childId/contacts/:contactId',
  validateParams(childAndUuidParams('contactId')),
  validate(updateContactSchema),
  contactsController.updateContact
);

// DELETE /api/v1/children/:childId/contacts/:contactId
router.delete(
  '/:childId/contacts/:contactId',
  validateParams(childAndUuidParams('contactId')),
  contactsController.deleteContact
);

export default router;
