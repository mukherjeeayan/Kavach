// device.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as deviceService from '../services/device.service';

const respond = (res: Response, status: number, data: unknown, req: Request) => {
  res.status(status).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  });
};

/**
 * POST /api/v1/devices/register
 * Body: { child_id, device_id?, device_name, device_type?, os_version?, fcm_token? }
 * Registers (or refreshes) a device for the parent's child.
 */
export const registerDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { child_id, device_id, device_name, device_type, os_version, fcm_token } = req.body;
    const device = await deviceService.registerDevice(req.user!.userId, {
      child_id,
      device_id,
      device_name,
      device_type,
      os_version,
      fcm_token,
    });
    respond(res, 201, { device }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/devices/:deviceId/heartbeat
 * Refreshes last_active for a device owned by the parent.
 */
export const heartbeat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deviceService.touchDevice(req.user!.userId, req.params.deviceId);
    respond(res, 200, { status: 'ok' }, req);
  } catch (err) {
    next(err);
  }
};