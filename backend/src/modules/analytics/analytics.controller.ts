// analytics.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';
import { respond } from '../../utils/response';

export const generateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportType = req.body.report_type || 'WEEKLY';
    const data = await analyticsService.generateReport(
      req.user!.userId, req.params.childId, reportType
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const getCachedReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportType = (req.query.type as 'WEEKLY' | 'MONTHLY') || 'WEEKLY';
    const data = await analyticsService.getCachedReport(
      req.user!.userId, req.params.childId, reportType
    );
    respond(res, 200, data ?? {}, req);
  } catch (err) { next(err); }
};

export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.listReports(req.user!.userId, req.params.childId);
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
