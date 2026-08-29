// reports.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service';
import { respond } from '../../utils/response';

/**
 * GET /api/v1/reports/safety?childId=xxx&period=week|month
 * Returns safety report for a child.
 */
export const getSafetyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { childId, period } = req.query as { childId: string; period: 'week' | 'month' };
    const data = await reportsService.getSafetyReport(
      req.user!.userId,
      childId,
      period || 'week'
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/location?childId=xxx&period=week|month
 * Returns location report for a child.
 */
export const getLocationReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { childId, period } = req.query as { childId: string; period: 'week' | 'month' };
    const data = await reportsService.getLocationReport(
      req.user!.userId,
      childId,
      period || 'week'
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/usage?childId=xxx&period=week|month
 * Returns usage report for a child.
 */
export const getUsageReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { childId, period } = req.query as { childId: string; period: 'week' | 'month' };
    const data = await reportsService.getUsageReport(
      req.user!.userId,
      childId,
      period || 'week'
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/communication?childId=xxx&period=week|month
 * Returns communication report for a child.
 */
export const getCommunicationReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { childId, period } = req.query as { childId: string; period: 'week' | 'month' };
    const data = await reportsService.getCommunicationReport(
      req.user!.userId,
      childId,
      period || 'week'
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};
