// settings.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.service';
import { respond } from '../../utils/response';

/**
 * GET /api/v1/settings
 * Returns the authenticated user's settings.
 */
export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getSettings(req.user!.userId);
    respond(res, 200, { settings }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/settings
 * Body: UpdateSettingsInput
 * Updates the authenticated user's settings.
 */
export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.updateSettings(req.user!.userId, req.body);
    respond(res, 200, { settings }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/settings/push-token
 * Body: { token, device_type? }
 * Saves FCM push token for push notifications.
 */
export const savePushToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, device_type } = req.body;
    const result = await settingsService.savePushToken(
      req.user!.userId,
      token,
      device_type || 'android'
    );
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};
