import { Request, Response, NextFunction } from 'express';
import * as locksService from './locks.service';

export const listLocks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locksService.listLocks(req.user!.userId, req.params.childId);
    res.status(200).json({
      success: true,
      data: { locks: data },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

export const createLock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locksService.createLock(req.user!.userId, req.params.childId, req.body);
    res.status(201).json({
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
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
    res.status(200).json({
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

export const deleteLock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await locksService.deleteLock(req.user!.userId, req.params.childId, req.params.lockId);
    res.status(200).json({
      success: true,
      data: { deleted: true },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};
