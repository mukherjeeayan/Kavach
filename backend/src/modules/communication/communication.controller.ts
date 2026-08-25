// communication.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as commService from './communication.service';
import { respond } from '../../utils/response';

export const uploadCommunications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await commService.recordCommunications(
      req.user!.userId, req.params.deviceId, req.body.entries
    );
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const listCommunications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const flaggedOnly = req.query.flagged === 'true';
    const data = await commService.listCommunications(
      req.user!.userId, req.params.childId, page, limit, flaggedOnly
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const listKeywordAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreviewedOnly = req.query.unreviewed === 'true';
    const data = await commService.listKeywordAlerts(
      req.user!.userId, req.params.childId, unreviewedOnly
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const reviewKeywordAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await commService.reviewKeywordAlert(
      req.user!.userId, req.params.childId, req.params.alertId
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
