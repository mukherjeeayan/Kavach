// deviceAlert.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as deviceAlertService from '../services/deviceAlert.service';

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

    res.status(200).json({
      success: true,
      data: { message: 'Tamper alert recorded' },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};