import { Request, Response, NextFunction } from 'express';
import * as locksService from './locks.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

export const listLocks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await locksService.listLocks(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { locks: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const createLock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locksService.createLock(req.user!.userId, req.params.childId, req.body);
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const updateLock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locksService.updateLock(
      req.user!.userId,
      req.params.childId,
      req.params.lockId,
      req.body
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const deleteLock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await locksService.deleteLock(req.user!.userId, req.params.childId, req.params.lockId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) {
    next(err);
  }
};
