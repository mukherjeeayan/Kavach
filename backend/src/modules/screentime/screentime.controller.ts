import { Request, Response, NextFunction } from 'express';
import * as screentimeService from './screentime.service';
import { respond } from '../../utils/response';

const today = () => new Date().toISOString().slice(0, 10);

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await screentimeService.recordScreenTime(
      req.user!.userId,
      req.params.deviceId,
      req.body.entries,
      req.body.batch_id
    );
    respond(res, 201, { uploaded: req.body.entries.length, duplicate_batch: result.duplicate }, req);
  } catch (err) {
    next(err);
  }
};

export const getDaily = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = (req.query.date as string | undefined) || today();
    const data = await screentimeService.getDailyScreenTime(
      req.user!.userId,
      req.params.childId,
      date
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = (req.query.range as 'day' | 'week' | 'month') || 'day';
    const data = await screentimeService.getScreenTimeSummary(
      req.user!.userId,
      req.params.childId,
      range
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};
