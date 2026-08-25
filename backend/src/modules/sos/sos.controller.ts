// sos.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as sosService from './sos.service';
import { respond } from '../../utils/response';

export const createSosEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sosService.createSosEvent(
      req.user!.userId, req.params.deviceId, req.body
    );
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const listSosEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const data = await sosService.listSosEvents(
      req.user!.userId, req.params.childId, status
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const acknowledgeSos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sosService.acknowledgeSos(
      req.user!.userId, req.params.childId, req.params.eventId
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const resolveSos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sosService.resolveSos(
      req.user!.userId, req.params.childId, req.params.eventId, req.body.notes
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
