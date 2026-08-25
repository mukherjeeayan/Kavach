// mood.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as moodService from './mood.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

export const createMoodLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await moodService.createMoodLog(
      req.user!.userId,
      req.params.deviceId,
      req.body
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const listMoodLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await moodService.listMoodLogs(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { mood_logs: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const getMoodSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await moodService.getMoodSummary(
      req.user!.userId,
      req.params.childId
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};
