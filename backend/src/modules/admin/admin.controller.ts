// admin.controller.ts
// Express route handlers for the admin panel API.
// All routes are protected by authenticateJWT + requireAdmin.

import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';

// ─── Users ────────────────────────────────────────────────────────────────────

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const search = req.query.search as string | undefined;

    const result = await adminService.listUsers(page, limit, search);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await adminService.getUserById(req.params.userId);
    res.json({ success: true, data: user, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

export const updateUserSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tier, trial_days } = req.body as { tier: string; trial_days?: number };
    const user = await adminService.updateUserSubscription(
      req.user!.userId,
      req.params.userId,
      tier,
      trial_days
    );
    res.json({ success: true, data: user, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body as { role: string };
    const user = await adminService.updateUserRole(req.user!.userId, req.params.userId, role);
    res.json({ success: true, data: user, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

// ─── Feature Flags ─────────────────────────────────────────────────────────────

export const listFeatureFlags = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flags = await adminService.listFeatureFlags();
    res.json({ success: true, data: flags, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

export const updateFeatureFlag = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_enabled, required_tier } = req.body as { is_enabled?: boolean; required_tier?: string };
    const flag = await adminService.updateFeatureFlag(
      req.user!.userId,
      req.params.key,
      { is_enabled, required_tier }
    );
    res.json({ success: true, data: flag, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

// ─── Stats ─────────────────────────────────────────────────────────────────────

export const getSystemStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getSystemStats();
    res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

// ─── Audit Integrity ──────────────────────────────────────────────────────────

export const verifyAuditIntegrity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const familyId = req.query.familyId as string;
    const { verifyAuditChain } = await import('../shared/audit.service');
    const result = await verifyAuditChain(familyId);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};
