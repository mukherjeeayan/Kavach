// geofence.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as geofenceService from './geofence.service';
import { respond } from '../../utils/response';

export const listGeofences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await geofenceService.listGeofences(
      req.user!.userId, req.params.childId, page, limit
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const createGeofence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await geofenceService.createGeofence(
      req.user!.userId, req.params.childId, req.body
    );
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const updateGeofence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await geofenceService.updateGeofence(
      req.user!.userId, req.params.childId, req.params.geofenceId, req.body
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const deleteGeofence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await geofenceService.deleteGeofence(
      req.user!.userId, req.params.childId, req.params.geofenceId
    );
    respond(res, 200, { deleted: true }, req);
  } catch (err) { next(err); }
};

export const checkGeofences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude } = req.body;
    const violations = await geofenceService.checkGeofences(
      req.user!.userId, req.params.deviceId, latitude, longitude
    );
    respond(res, 200, { violations }, req);
  } catch (err) { next(err); }
};

export const checkGeofencesForChild = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude } = req.body;
    const data = await geofenceService.checkGeofencesForChild(
      req.user!.userId, req.params.childId, latitude, longitude
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};
