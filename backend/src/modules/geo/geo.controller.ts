// geo.controller.ts
// Serves third-party map credentials at runtime so tokens never need
// to be baked into the frontend bundle (Vite inlines VITE_* vars into
// shipped JS — a publicly extractable token).
import { NextFunction, Request, Response } from 'express';
import { respond, respondError } from '../../utils/response';

export const getMapboxToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) {
      return respondError(res, 503, 'Map integration is not configured', req);
    }
    respond(res, 200, { token }, req);
  } catch (err) {
    next(err);
  }
};
