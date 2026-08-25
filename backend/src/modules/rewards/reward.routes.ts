// reward.routes.ts
// Reward system: catalog CRUD (parent), points (parent awards), redemptions (child redeems, parent resolves).

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams, childAndUuidParams, paginationQuery } from '../../middleware/params';
import {
  createCatalogSchema,
  updateCatalogSchema,
  awardPointsSchema,
  redeemRewardSchema,
  resolveRedemptionSchema,
} from './reward.dto';
import * as rewardController from './reward.controller';

// ── Parent-side: catalog CRUD (mounted at /api/v1) ─────────────
export const rewardCatalogRouter = (() => {
  const router = Router();
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // GET /api/v1/rewards/catalog
  router.get(
    '/catalog',
    validateQuery(paginationQuery),
    rewardController.listCatalog
  );

  // POST /api/v1/rewards/catalog
  router.post(
    '/catalog',
    validate(createCatalogSchema),
    rewardController.createCatalogItem
  );

  // PUT /api/v1/rewards/catalog/:rewardId
  router.put(
    '/catalog/:rewardId',
    validateParams(uuidParams('rewardId')),
    validate(updateCatalogSchema),
    rewardController.updateCatalogItem
  );

  // DELETE /api/v1/rewards/catalog/:rewardId
  router.delete(
    '/catalog/:rewardId',
    validateParams(uuidParams('rewardId')),
    rewardController.deleteCatalogItem
  );

  return router;
})();

// ── Parent-side: child-scoped points + redemptions ──────────────
export const rewardParentRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('parent'));

  // POST /api/v1/children/:childId/rewards/points
  router.post(
    '/:childId/rewards/points',
    validateParams(uuidParams('childId')),
    validate(awardPointsSchema),
    rewardController.awardPoints
  );

  // GET /api/v1/children/:childId/rewards/points/balance
  router.get(
    '/:childId/rewards/points/balance',
    validateParams(uuidParams('childId')),
    rewardController.getPointsBalance
  );

  // GET /api/v1/children/:childId/rewards/points
  router.get(
    '/:childId/rewards/points',
    validateParams(uuidParams('childId')),
    validateQuery(paginationQuery),
    rewardController.listPointsLedger
  );

  // GET /api/v1/children/:childId/rewards/redemptions
  router.get(
    '/:childId/rewards/redemptions',
    validateParams(uuidParams('childId')),
    validateQuery(paginationQuery),
    rewardController.listRedemptions
  );

  // PUT /api/v1/children/:childId/rewards/redemptions/:redemptionId
  router.put(
    '/:childId/rewards/redemptions/:redemptionId',
    validateParams(childAndUuidParams('redemptionId')),
    validate(resolveRedemptionSchema),
    rewardController.resolveRedemption
  );

  return router;
})();

// ── Child-side routes (browse catalog, redeem) ──────────────────
export const rewardChildRouter = (() => {
  const router = Router({ mergeParams: true });
  router.use(authenticateJWT);
  router.use(requireRole('child'));

  // GET /api/v1/children/:childId/rewards/browse
  router.get(
    '/:childId/rewards/browse',
    validateParams(uuidParams('childId')),
    validateQuery(paginationQuery),
    rewardController.browseCatalog
  );

  // POST /api/v1/children/:childId/rewards/redeem
  router.post(
    '/:childId/rewards/redeem',
    validateParams(uuidParams('childId')),
    validate(redeemRewardSchema),
    rewardController.redeemReward
  );

  // GET /api/v1/children/:childId/rewards/points/balance
  router.get(
    '/:childId/rewards/points/balance',
    validateParams(uuidParams('childId')),
    rewardController.getPointsBalance
  );

  return router;
})();
