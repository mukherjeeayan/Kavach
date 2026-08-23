import { Request, Response, NextFunction } from 'express';
import * as locationService from './location.service';
import { respond } from '../../utils/response';

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await locationService.recordLocation(req.user!.userId, req.params.deviceId, req.body);
    respond(res, 201, { recorded: true }, req);
  } catch (err) {
    next(err);
  }
};

export const getCurrent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locationService.getCurrentLocations(req.user!.userId, req.params.childId);
    respond(res, 200, { locations: data }, req);
  } catch (err) {
    next(err);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locationService.getLocationHistory(
      req.user!.userId,
      req.params.childId,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
      Number(req.query.limit) || 100
    );
    respond(res, 200, { locations: data }, req);
  } catch (err) {
    next(err);
  }
};
