// daily-location-summary.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as dailyLocService from './daily-location-summary.service';
import { respond } from '../../utils/response';

export const getDailySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const data = await dailyLocService.getDailySummary(
      req.user!.userId, req.params.childId, date
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const getDailySummaryList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        data: {},
        error: 'startDate and endDate are required',
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] || 'unknown',
      });
    }
    const data = await dailyLocService.getDailySummaryList(
      req.user!.userId, req.params.childId, startDate, endDate
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
