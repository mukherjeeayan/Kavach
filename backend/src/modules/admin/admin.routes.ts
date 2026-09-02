// admin.routes.ts
// All routes here require admin role.

import { Router } from 'express';
import { authenticateJWT, requireAdmin } from '../../middleware/auth';
import * as adminController from './admin.controller';

const router = Router();

// All admin routes require a valid JWT AND admin role
router.use(authenticateJWT, requireAdmin);

// ─── System stats ─────────────────────────────────────────────────────────────
router.get('/stats', adminController.getSystemStats);

// ─── User management ──────────────────────────────────────────────────────────
router.get('/users',                           adminController.listUsers);
router.get('/users/:userId',                   adminController.getUserById);
router.patch('/users/:userId/subscription',    adminController.updateUserSubscription);
router.patch('/users/:userId/role',            adminController.updateUserRole);

// ─── Feature flags ────────────────────────────────────────────────────────────
router.get('/feature-flags',         adminController.listFeatureFlags);
router.patch('/feature-flags/:key',  adminController.updateFeatureFlag);

// ─── Audit integrity verification ─────────────────────────────────────────────
router.get('/audit/verify', adminController.verifyAuditIntegrity);

export default router;
