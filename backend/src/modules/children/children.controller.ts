// children.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as childrenService from './children.service';
import { buildPaginationMeta } from '../../utils/pagination';

const respond = (res: Response, status: number, data: unknown, req: Request) => {
  res.status(status).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  });
};

/**
 * GET /api/v1/children?page=1&limit=20
 * Lists all child profiles belonging to the authenticated parent.
 */
export const listChildren = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await childrenService.listChildren(
      req.user!.userId,
      page,
      limit
    );
    respond(
      res,
      200,
      { children: items, pagination: buildPaginationMeta(page, limit, total) },
      req
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/children
 * Body: { name, birth_date? }
 * Creates a new child profile for the authenticated parent.
 */
export const createChild = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, birth_date } = req.body;
    const child = await childrenService.createChild(req.user!.userId, name, birth_date);
    respond(res, 201, { child }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/children/:childId/screen-time-limit
 * Body: { limit_minutes: number | null }
 * Sets or clears the child's daily screen-time limit.
 */
export const setScreenTimeLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit_minutes } = req.body;
    const child = await childrenService.setScreenTimeLimit(
      req.user!.userId,
      req.params.childId,
      limit_minutes
    );
    respond(res, 200, { child }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/children/:childId/alerts
 * Recent tamper/limit alerts for the child (from the audit log).
 */
export const listAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const alerts = await childrenService.listChildAlerts(
      req.user!.userId,
      req.params.childId,
      limit
    );
    respond(res, 200, { alerts }, req);
  } catch (err) {
    next(err);
  }
};