// appBlocking.controller.ts
// HTTP-only concerns: parse request, call service, format response.
// Zero business logic lives here.

import { Request, Response, NextFunction } from 'express';
import * as appBlockingService from '../services/appBlocking.service';

/**
 * GET /api/v1/children/:childId/apps/blocked
 * Returns: 200 with list of blocked apps
 */
export const getBlockedApps = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId } = req.params;

    const blockedApps = await appBlockingService.getBlockedApps(parentId, childId);

    res.status(200).json({
      success: true,
      data: blockedApps,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/children/:childId/apps/block
 * Body: { device_id, package_name, app_name?, block_reason? }
 * Returns: 201 with the created/updated block rule
 */
export const blockApp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId } = req.params;
    const { device_id, package_name, app_name, block_reason } = req.body;

    const rule = await appBlockingService.blockApp(
      parentId,
      childId,
      device_id,
      package_name,
      app_name,
      block_reason
    );

    res.status(201).json({
      success: true,
      data: rule,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/children/:childId/apps/block/:ruleId
 * Returns: 200 on successful deletion
 */
export const unblockApp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId, ruleId } = req.params;

    await appBlockingService.unblockApp(parentId, childId, ruleId);

    res.status(200).json({
      success: true,
      data: { message: 'App unblocked successfully' },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/children/:childId/apps/unblock-request
 * Body: { rule_id, reason }
 * Returns: 201 with the updated rule containing the unblock request
 */
export const requestUnblock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId } = req.params;
    const { rule_id, reason } = req.body;

    const updatedRule = await appBlockingService.requestUnblock(
      parentId,
      childId,
      rule_id,
      reason
    );

    res.status(201).json({
      success: true,
      data: updatedRule,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/children/:childId/apps/block/:ruleId/approve-unblock
 * Parent approves a pending unblock request — the app is unblocked.
 */
export const approveUnblock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId, ruleId } = req.params;

    const rule = await appBlockingService.approveUnblock(parentId, childId, ruleId);

    res.status(200).json({
      success: true,
      data: rule,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/children/:childId/apps/block/:ruleId/reject-unblock
 * Parent rejects a pending unblock request — the app stays blocked.
 */
export const rejectUnblock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId, ruleId } = req.params;

    const rule = await appBlockingService.rejectUnblock(parentId, childId, ruleId);

    res.status(200).json({
      success: true,
      data: rule,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/children/:childId/apps/unblock-requests
 * Returns: 200 with list of pending unblock requests
 */
export const getUnblockRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user!.userId;
    const { childId } = req.params;

    const requests = await appBlockingService.getUnblockRequests(parentId, childId);

    res.status(200).json({
      success: true,
      data: requests,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};
