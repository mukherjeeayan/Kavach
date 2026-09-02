// pushNotificationService.ts
// High-level helpers for sending FCM push notifications to parents.
// Resolves the parent's registered push tokens, sends via firebase
// service, and never throws — pushes are best-effort.

import pool from '../../config/database';
import { sendMulticastNotification } from './firebase.service';
import logger from '../../utils/logger';

export async function sendPushToParent(
  parentId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  priority: 'normal' | 'high' = 'normal'
): Promise<{ success: number; failure: number }> {
  try {
    const result = await pool.query(
      'SELECT token FROM push_tokens WHERE user_id = $1',
      [parentId]
    );
    const tokens = result.rows.map((r: { token: string }) => r.token);
    if (tokens.length === 0) {
      logger.debug(`No push tokens for parent ${parentId}`);
      return { success: 0, failure: 0 };
    }
    return await sendMulticastNotification(tokens, title, body, data, priority);
  } catch (err) {
    logger.error(`Failed to send push to parent ${parentId}:`, err);
    return { success: 0, failure: 0 };
  }
}

export async function sendPushToAllParents(
  childId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  priority: 'normal' | 'high' = 'normal'
): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT DISTINCT p.id FROM parents p
       INNER JOIN child_guardians cg ON cg.parent_id = p.id
       WHERE cg.child_id = $1`,
      [childId]
    );
    const parentIds = result.rows.map((r: { id: string }) => r.id);
    await Promise.all(
      parentIds.map((parentId) => sendPushToParent(parentId, title, body, data, priority))
    );
  } catch (err) {
    logger.error(`Failed to send push to parents of child ${childId}:`, err);
  }
}
