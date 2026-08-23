// children.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as childrenService from './children.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await childrenService.listChildAlerts(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
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
 * POST /api/v1/children/:childId/alerts/ack
 * Body: { alert_ids?: string[] } — omit to acknowledge all.
 */
export const acknowledgeAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await childrenService.acknowledgeAlerts(
      req.user!.userId,
      req.params.childId,
      req.body?.alert_ids
    );
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};
/**
 * GET /api/v1/children/:childId
 * Returns a single child profile owned by the parent.
 */
export const getChild = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const child = await childrenService.getChild(req.user!.userId, req.params.childId);
    respond(res, 200, { child }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/children/:childId
 * Body: { name?, birth_date? }
 * Updates a child profile.
 */
export const updateChild = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const child = await childrenService.updateChild(req.user!.userId, req.params.childId, req.body);
    respond(res, 200, { child }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/children/:childId
 * Deletes the child profile and cascades devices/rules/logs/consents.
 */
export const deleteChild = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await childrenService.deleteChild(req.user!.userId, req.params.childId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/children/:childId/guardians
 * Lists all guardians (including the owner) of the child.
 */
export const listGuardians = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardians = await childrenService.listGuardians(req.user!.userId, req.params.childId);
    respond(res, 200, { guardians }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/children/:childId/guardians
 * Body: { email } — owner shares the child with another parent account.
 */
export const addGuardian = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardian = await childrenService.addGuardian(
      req.user!.userId,
      req.params.childId,
      req.body.email
    );
    respond(res, 201, { guardian }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/children/:childId/guardians/:guardianId
 * Owner revokes a guardian's access.
 */
export const removeGuardian = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await childrenService.removeGuardian(
      req.user!.userId,
      req.params.childId,
      req.params.guardianId
    );
    respond(res, 200, { removed: true }, req);
  } catch (err) {
    next(err);
  }
};
