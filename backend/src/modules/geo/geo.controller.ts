// geo.controller.ts
// Serves third-party map credentials at runtime so tokens never need
// to be baked into the frontend bundle (Vite inlines VITE_* vars into
// shipped JS — a publicly extractable token).
import { Request, Response } from 'express';

export const getMapboxToken = async (req: Request, res: Response) => {
  const token = process.env.MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    return res.status(503).json({
      success: false,
      data: {},
      error: 'Map integration is not configured',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  }
  res.status(200).json({
    success: true,
    data: { token },
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  });
};
