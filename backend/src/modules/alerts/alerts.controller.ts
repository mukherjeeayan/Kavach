// alerts.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as alertsService from './alerts.service';
import { respond } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';

/**
 * GET /api/v1/children/:childId/alerts
 * Query: page, limit, alert_type, unacknowledged_only
 * Returns paginated alerts for a child.
 */
export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, total } = await alertsService.getAlerts(
      req.user!.userId,
      req.params.childId,
      req.query as any
    );
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    respond(
      res,
      200,
      { alerts: items, pagination: buildPaginationMeta(page, limit, total) },
      req
    );
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/children/:childId/alerts/:alertId/read
 * Marks an alert as read.
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert = await alertsService.markAsRead(
      req.user!.userId,
      req.params.childId,
      req.params.alertId
    );
    respond(res, 200, { alert }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/children/:childId/alerts/:alertId
 * Deletes (acknowledges) an alert.
 */
export const deleteAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await alertsService.deleteAlert(
      req.user!.userId,
      req.params.childId,
      req.params.alertId
    );
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};
