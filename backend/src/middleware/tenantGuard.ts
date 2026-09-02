// tenantGuard.ts
// Defense-in-depth BOLA/IDOR prevention middleware.
//
// Every child-scoped or device-scoped route MUST use one of these
// middlewares AFTER authenticateJWT + requireRole('parent'). The
// middleware verifies the authenticated parent actually owns (or is
// guardian of) the target child/device BEFORE the controller runs.
//
// Returns 404 (not 403) to prevent entity enumeration: an attacker
// probing random UUIDs gets "not found" rather than "forbidden".

import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import logger from '../utils/logger';

/**
 * Verify the authenticated parent owns (or is guardian of) the child
 * identified by req.params.childId. On success, attaches verified
 * child info to req for downstream use.
 */
export const requireChildOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const parentId = req.user?.userId;
  const childId = req.params.childId;

  if (!parentId || !childId) {
    return res.status(404).json({
      success: false,
      data: {},
      error: 'Resource not found',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] ?? 'unknown',
    });
  }

  try {
    const result = await pool.query(
      `SELECT 1 FROM children c
       WHERE c.id = $1
         AND ($2 = c.parent_id OR EXISTS (
           SELECT 1 FROM child_guardians g
           WHERE g.child_id = c.id AND g.parent_id = $2
         ))`,
      [childId, parentId]
    );

    if ((result.rowCount ?? 0) === 0) {
      logger.warn(
        `BOLA attempt blocked: parent ${parentId} denied access to child ${childId}`
      );
      return res.status(404).json({
        success: false,
        data: {},
        error: 'Resource not found',
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] ?? 'unknown',
      });
    }

    next();
  } catch (err) {
    logger.error(`Tenant guard query failed: ${err}`);
    next(err);
  }
};

/**
 * Verify the authenticated parent owns the device identified by
 * req.params.deviceId. The device must belong to a child the parent
 * owns or guardians.
 */
export const requireDeviceOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const parentId = req.user?.userId;
  const deviceId = req.params.deviceId;

  if (!parentId || !deviceId) {
    return res.status(404).json({
      success: false,
      data: {},
      error: 'Resource not found',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] ?? 'unknown',
    });
  }

  try {
    const result = await pool.query(
      `SELECT 1 FROM devices d
       JOIN children c ON c.id = d.child_id
       WHERE d.id = $1
         AND ($2 = c.parent_id OR EXISTS (
           SELECT 1 FROM child_guardians g
           WHERE g.child_id = c.id AND g.parent_id = $2
         ))`,
      [deviceId, parentId]
    );

    if ((result.rowCount ?? 0) === 0) {
      logger.warn(
        `BOLA attempt blocked: parent ${parentId} denied access to device ${deviceId}`
      );
      return res.status(404).json({
        success: false,
        data: {},
        error: 'Resource not found',
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] ?? 'unknown',
      });
    }

    next();
  } catch (err) {
    logger.error(`Device tenant guard query failed: ${err}`);
    next(err);
  }
};
