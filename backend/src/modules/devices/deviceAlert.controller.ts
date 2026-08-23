// deviceAlert.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as deviceAlertService from './deviceAlert.service';
import { respond } from '../../utils/response';

/**
 * POST /api/v1/devices/:deviceId/tamper-alert
 * Body: { details }
 * Returns: 200 once the alert is persisted
 */
export const reportTamper = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = req.user!.userId;
    const { deviceId } = req.params;
    const { details } = req.body;

    await deviceAlertService.reportTamperAlert(actorId, deviceId, details);

    respond(res, 200, { message: 'Tamper alert recorded' }, req);
  } catch (err) {
    next(err);
  }
};