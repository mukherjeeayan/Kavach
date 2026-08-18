// children.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as childrenService from '../services/children.service';

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
 * GET /api/v1/children
 * Lists all child profiles belonging to the authenticated parent.
 */
export const listChildren = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const children = await childrenService.listChildren(req.user!.userId);
    respond(res, 200, { children }, req);
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