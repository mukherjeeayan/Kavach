// deviceHealth.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as deviceHealthService from './deviceHealth.service';
import { respond } from '../../utils/response';

export const recordHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await deviceHealthService.recordHealth(
      req.user!.userId, req.params.deviceId, req.body
    );
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const getLatestHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await deviceHealthService.getLatestHealth(
      req.user!.userId, req.params.childId, req.params.deviceId
    );
    respond(res, 200, data ?? {}, req);
  } catch (err) { next(err); }
};

export const getHealthHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 48;
    const data = await deviceHealthService.getHealthHistory(
      req.user!.userId, req.params.childId, req.params.deviceId, limit
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
