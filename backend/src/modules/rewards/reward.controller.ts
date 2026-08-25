// reward.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as rewardService from './reward.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

// ─── Catalog Controllers ────────────────────────────────────────

export const listCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await rewardService.listCatalog(
      req.user!.userId,
      page,
      limit
    );
    respond(res, 200, { catalog: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const createCatalogItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rewardService.createCatalogItem(req.user!.userId, req.body);
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const updateCatalogItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rewardService.updateCatalogItem(
      req.user!.userId,
      req.params.rewardId,
      req.body
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const deleteCatalogItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await rewardService.deleteCatalogItem(req.user!.userId, req.params.rewardId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) {
    next(err);
  }
};

// ─── Points Controllers ─────────────────────────────────────────

export const awardPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rewardService.awardPoints(
      req.user!.userId,
      req.params.childId,
      req.body
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const getPointsBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await rewardService.getPointsBalance(
      req.user!.userId,
      req.params.childId
    );
    respond(res, 200, { balance }, req);
  } catch (err) {
    next(err);
  }
};

export const listPointsLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await rewardService.listPointsLedger(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { points: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

// ─── Redemption Controllers ─────────────────────────────────────

export const browseCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await rewardService.browseCatalog(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { catalog: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const redeemReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rewardService.redeemReward(
      req.user!.userId,
      req.params.childId,
      req.body
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const resolveRedemption = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await rewardService.resolveRedemption(
      req.user!.userId,
      req.params.childId,
      req.params.redemptionId,
      req.body.status,
      req.body.parent_notes
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const listRedemptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const { items, total } = await rewardService.listRedemptions(
      req.user!.userId,
      req.params.childId,
      status,
      page,
      limit
    );
    respond(res, 200, { redemptions: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};
