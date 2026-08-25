// urlFilter.routes.ts
// Mounted at: /api/v1/children (mergeParams exposes :childId)

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams } from '../../middleware/validate';
import { uuidParams, childAndUuidParams } from '../../middleware/params';
import { createUrlFilterSchema, updateUrlFilterSchema } from './urlFilter.dto';
import * as urlFilterController from './urlFilter.controller';
import { getActiveRulesForChild } from './urlFilter.service';
import { respond } from '../../utils/response';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/children/:childId/url-filters
router.get(
  '/:childId/url-filters',
  validateParams(uuidParams('childId')),
  urlFilterController.listRules
);

// POST /api/v1/children/:childId/url-filters
router.post(
  '/:childId/url-filters',
  validateParams(uuidParams('childId')),
  validate(createUrlFilterSchema),
  urlFilterController.createRule
);

// PUT /api/v1/children/:childId/url-filters/:ruleId
router.put(
  '/:childId/url-filters/:ruleId',
  validateParams(childAndUuidParams('ruleId')),
  validate(updateUrlFilterSchema),
  urlFilterController.updateRule
);

// DELETE /api/v1/children/:childId/url-filters/:ruleId
router.delete(
  '/:childId/url-filters/:ruleId',
  validateParams(childAndUuidParams('ruleId')),
  urlFilterController.deleteRule
);

// GET /api/v1/children/:childId/url-filters/sync (device-side: get active rules)
router.get(
  '/:childId/url-filters/sync',
  validateParams(uuidParams('childId')),
  async (req, res, next) => {
    try {
      const rules = await getActiveRulesForChild(req.params.childId);
      respond(res, 200, { rules }, req);
    } catch (err) { next(err); }
  }
);

export default router;
