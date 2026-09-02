// geo.controller.ts
// Serves map credentials and geofence-related endpoints.
//
// DEPRECATED: The /mapbox-token endpoint is deprecated.
// The frontend now uses React-Leaflet + OpenStreetMap (100% free).
// This endpoint is kept for backwards compatibility only.
//
// New implementations should use OpenStreetMap tiles directly
// without requiring any API tokens.

import { NextFunction, Request, Response } from 'express';
import { respond, respondError } from '../../utils/response';

/**
 * @deprecated This endpoint is deprecated. The frontend now uses
 * React-Leaflet + OpenStreetMap which requires no API tokens.
 * This endpoint is kept for backwards compatibility only.
 */
export const getMapboxToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) {
      // Return a helpful message explaining the deprecation
      return respondError(
        res,
        503,
        'Mapbox integration is deprecated. The application now uses OpenStreetMap (free, no token required).',
        req
      );
    }
    // If token is still configured, return it for backwards compatibility
    respond(res, 200, { token, deprecated: true }, req);
  } catch (err) {
    next(err);
  }
};
