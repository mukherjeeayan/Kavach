import { Request, Response, NextFunction } from 'express';
import * as locationService from './location.service';

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await locationService.recordLocation(req.user!.userId, req.params.deviceId, req.body);
    res.status(201).json({
      success: true,
      data: { recorded: true },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

export const getCurrent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locationService.getCurrentLocations(req.user!.userId, req.params.childId);
    res.status(200).json({
      success: true,
      data: { locations: data },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await locationService.getLocationHistory(
      req.user!.userId,
      req.params.childId,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
      Number(req.query.limit) || 100
    );
    res.status(200).json({
      success: true,
      data: { locations: data },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};
