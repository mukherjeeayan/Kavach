// notifications.routes.ts
// Mounted at: /api/v1/notifications

import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { validateParams, validateQuery } from '../../middleware/validate';
import { uuidParams } from '../../middleware/params';
import { notificationsQuerySchema } from './notifications.dto';
import * as notificationsController from './notifications.controller';

const router = Router();

router.use(authenticateJWT);

// GET /api/v1/notifications
router.get('/', validateQuery(notificationsQuerySchema), notificationsController.getNotifications);

// GET /api/v1/notifications/unread-count
router.get('/unread-count', notificationsController.getUnreadCount);

// PATCH /api/v1/notifications/:id/read
router.patch(
  '/:id/read',
  validateParams(uuidParams('id')),
  notificationsController.markAsRead
);

// POST /api/v1/notifications/read-all
router.post('/read-all', notificationsController.markAllAsRead);

// DELETE /api/v1/notifications/:id
router.delete(
  '/:id',
  validateParams(uuidParams('id')),
  notificationsController.deleteNotification
);

export default router;
