// consent.middleware.ts
// DPDP enforcement gate: blocks data-ingestion routes unless the
// parent has granted (and not revoked) the relevant consent for the
// child that owns the target device.
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { hasActiveConsent } from '../modules/consent/parentalConsent.service';

export const requireConsent = (consentType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceId = req.params.deviceId;
      if (!deviceId) {
        return res.status(422).json({
          success: false,
          data: {},
          error: 'deviceId is required',
          timestamp: new Date().toISOString(),
          request_id: (req.headers['x-request-id'] as string) ?? 'unknown',
        });
      }

      const device = await query(
        `SELECT child_id FROM devices WHERE id = $1`,
        [deviceId]
      );
      const childId = device.rows[0]?.child_id;
      if (!childId) {
        return res.status(404).json({
          success: false,
          data: {},
          error: 'Device not found',
          timestamp: new Date().toISOString(),
          request_id: (req.headers['x-request-id'] as string) ?? 'unknown',
        });
      }

      const granted = await hasActiveConsent(childId, consentType);
      if (!granted) {
        return res.status(403).json({
          success: false,
          data: {},
          error: `Parental consent ('${consentType}') has not been granted for this child`,
          timestamp: new Date().toISOString(),
          request_id: (req.headers['x-request-id'] as string) ?? 'unknown',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
