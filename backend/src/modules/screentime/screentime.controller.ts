import { Request, Response, NextFunction } from 'express';
import * as screentimeService from './screentime.service';

const today = () => new Date().toISOString().slice(0, 10);

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await screentimeService.recordScreenTime(
      req.user!.userId,
      req.params.deviceId,
      req.body.entries
    );
    res.status(201).json({
      success: true,
      data: { uploaded: req.body.entries.length },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
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

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = (req.query.range as 'day' | 'week' | 'month') || 'day';
    const data = await screentimeService.getScreenTimeSummary(
      req.user!.userId,
      req.params.childId,
      range
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
