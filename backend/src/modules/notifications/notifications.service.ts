// notifications.service.ts
// Business logic for notifications (in-app notifications for parents).

import { query } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { toOffset } from '../../utils/pagination';
import type { NotificationsQueryInput } from './notifications.dto';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Get notifications for a user with pagination and filtering.
 */
export const getNotifications = async (
  userId: string,
  params: NotificationsQueryInput
): Promise<{ items: Notification[]; total: number }> => {
  const { page, limit, unread_only, notification_type } = params;
  const offset = toOffset(page, limit);
  const conditions: string[] = ['user_id = $1'];
  const values: any[] = [userId];
  let paramIndex = 2;

  if (unread_only) {
    conditions.push(`is_read = false`);
  }

  if (notification_type) {
    conditions.push(`notification_type = $${paramIndex}`);
    values.push(notification_type);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const [itemsResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM notifications WHERE ${whereClause}`,
      values
    ),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0].total,
  };
};

/**
 * Get a single notification by ID and verify ownership.
 */
export const getNotificationById = async (
  userId: string,
  notificationId: string
): Promise<Notification> => {
  const result = await query(
    `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notification not found');
  }

  return result.rows[0];
};

/**
 * Mark a notification as read.
 */
export const markAsRead = async (
  userId: string,
  notificationId: string
): Promise<Notification> => {
  const notification = await getNotificationById(userId, notificationId);

  if (notification.is_read) {
    return notification;
  }

  const result = await query(
    `UPDATE notifications
     SET is_read = true
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );

  return result.rows[0];
};

/**
 * Mark all notifications as read for a user.
 */
export const markAllAsRead = async (
  userId: string
): Promise<{ marked: number }> => {
  const result = await query(
    `UPDATE notifications
     SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );

  return { marked: result.rowCount ?? 0 };
};

/**
 * Delete a notification.
 */
export const deleteNotification = async (
  userId: string,
  notificationId: string
): Promise<{ deleted: boolean }> => {
  await getNotificationById(userId, notificationId);

  const result = await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );

  return { deleted: (result.rowCount ?? 0) > 0 };
};

/**
 * Create a notification for a user. Used internally by other services
 * when events occur (SOS, keyword alerts, etc.).
 */
export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  notificationType: string,
  referenceId?: string
): Promise<Notification> => {
  const result = await query(
    `INSERT INTO notifications (user_id, title, body, notification_type, reference_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, title, body, notificationType, referenceId || null]
  );

  return result.rows[0];
};

/**
 * Get unread notification count for a user.
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );

  return result.rows[0].count;
};
