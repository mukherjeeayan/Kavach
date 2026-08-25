// security.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as securityService from './security.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

// ─── Device-side controllers ────────────────────────────────────

export const recordSecurityScan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await securityService.recordSecurityScan(
      req.user!.userId,
      req.params.deviceId,
      req.body
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const recordWifiLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await securityService.recordWifiLog(
      req.user!.userId,
      req.params.deviceId,
      req.body
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

// ─── Parent-side controllers ────────────────────────────────────

export const listSecurityScans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await securityService.listSecurityScans(
      req.user!.userId,
      req.params.childId,
      req.params.deviceId,
      page,
      limit
    );
    respond(res, 200, { scans: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const listWifiLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await securityService.listWifiLogs(
      req.user!.userId,
      req.params.childId,
      req.params.deviceId,
      page,
      limit
    );
    respond(res, 200, { wifi_logs: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};
