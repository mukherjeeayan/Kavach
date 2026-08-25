// selfHarm.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as selfHarmService from './selfHarm.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

export const listAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const unacknowledgedOnly = req.query.unacknowledged === 'true';
    const { items, total } = await selfHarmService.listAlerts(
      req.user!.userId,
      req.params.childId,
      unacknowledgedOnly,
      page,
      limit
    );
    respond(res, 200, { alerts: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const acknowledgeAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await selfHarmService.acknowledgeAlert(
      req.user!.userId,
      req.params.childId,
      req.params.alertId
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const getUnacknowledgedCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await selfHarmService.getUnacknowledgedCount(req.params.childId);
    respond(res, 200, { unacknowledged_count: count }, req);
  } catch (err) {
    next(err);
  }
};
