// communication-log.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as commLogService from './communication-log.service';
import { respond } from '../../utils/response';

export const listCommunicationLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await commLogService.listCommunicationLogs(
      req.user!.userId, req.params.childId, page, limit
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const createCommunicationLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await commLogService.createCommunicationLog(
      req.user!.userId, req.params.childId, req.body
    );
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const getCommunicationLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await commLogService.getCommunicationLog(
      req.user!.userId, req.params.childId, req.params.logId
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const deleteCommunicationLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await commLogService.deleteCommunicationLog(
      req.user!.userId, req.params.childId, req.params.logId
    );
    respond(res, 200, { deleted: true }, req);
  } catch (err) { next(err); }
};
