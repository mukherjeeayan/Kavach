// notifications.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as notificationsService from './notifications.service';
import { respond } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';

/**
 * GET /api/v1/notifications
 * Query: page, limit, unread_only, notification_type
 * Returns paginated notifications for the authenticated user.
 */
export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, total } = await notificationsService.getNotifications(
      req.user!.userId,
      req.query as any
    );
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    respond(
      res,
      200,
      { notifications: items, pagination: buildPaginationMeta(page, limit, total) },
      req
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/notifications/unread-count
 * Returns the count of unread notifications.
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationsService.getUnreadCount(req.user!.userId);
    respond(res, 200, { count }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a notification as read.
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await notificationsService.markAsRead(
      req.user!.userId,
      req.params.id
    );
    respond(res, 200, { notification }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/notifications/read-all
 * Marks all notifications as read.
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationsService.markAllAsRead(req.user!.userId);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/notifications/:id
 * Deletes a notification.
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationsService.deleteNotification(
      req.user!.userId,
      req.params.id
    );
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};
