// statistics.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as statisticsService from './statistics.service';
import { respond } from '../../utils/response';

export const getOverviewStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as 'week' | 'month') || 'week';
    const data = await statisticsService.getOverviewStats(
      req.user!.userId, req.params.childId, period
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const getSafetyScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await statisticsService.getSafetyScore(
      req.user!.userId, req.params.childId
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const getUsageSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as 'week' | 'month') || 'week';
    const data = await statisticsService.getUsageSummary(
      req.user!.userId, req.params.childId, period
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const getRestrictionCompliance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await statisticsService.getRestrictionCompliance(
      req.user!.userId, req.params.childId
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
