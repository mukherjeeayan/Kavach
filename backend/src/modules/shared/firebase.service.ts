// firebase.service.ts
// Optional Firebase Cloud Messaging integration for pushing events to
// the child's device (unblock decisions, new blocks, limit changes).
//
// Degrades gracefully: when no service-account credentials are
// configured the send helpers log a warning and no-op, so the rest of
// the API keeps working in development without any Firebase setup.

import { query } from '../../config/database';
import logger from '../../utils/logger';

type FirebaseMessaging = {
  send: (message: Record<string, unknown>) => Promise<string>;
  sendEachForMulticast: (message: Record<string, unknown>) => Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{
      success: boolean;
      error?: { code?: string; message?: string };
    }>;
  }>;
};

let messaging: FirebaseMessaging | null = null;
let initAttempted = false;

const getMessaging = (): FirebaseMessaging | null => {
  if (messaging) return messaging;
  if (initAttempted) return null;

  initAttempted = true;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM pushes disabled');
    return null;
  }

  try {
    // firebase-admin is a heavy optional dependency — resolve it
    // lazily so tests and non-Firebase deployments never load it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      });
    }
    messaging = admin.messaging();
    logger.info('Firebase Messaging initialised');
    return messaging;
  } catch (e) {
    logger.warn('Firebase Messaging unavailable, FCM pushes disabled', e as Error);
    return null;
  }
};

/**
 * Push a notification to every registered device of a child. Falls
 * back to a no-op (with a warning) when Firebase is not configured.
 * Never throws — pushes are best-effort and must not break API calls.
 */
export const sendToChild = async (
  childId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> => {
  const m = getMessaging();
  if (!m) return;

  try {
    const devices = await query(
      `SELECT fcm_token FROM devices
       WHERE child_id = $1 AND fcm_token IS NOT NULL AND fcm_token <> ''`,
      [childId]
    );
    const tokens = devices.rows.map((r: Record<string, any>) => r.fcm_token as string);
    if (tokens.length === 0) return;

    await m.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
    logger.info(`FCM push sent to ${tokens.length} device(s) for child ${childId}`);
  } catch (e) {
    logger.warn(`FCM push to child ${childId} failed`, e as Error);
  }
};

/**
 * Send a multicast push notification to a list of FCM tokens.
 * Returns { success, failure } counts. When Firebase is not
 * configured this is a no-op that returns { 0, 0 } so callers can
 * continue without erroring. Never throws.
 *
 * @param priority - 'normal' (default) or 'high' for emergency alerts.
 *   High-priority payloads bypass Doze mode, battery optimization,
 *   and app standby to ensure immediate delivery.
 */
export const sendMulticastNotification = async (
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {},
  priority: 'normal' | 'high' = 'normal'
): Promise<{ success: number; failure: number }> => {
  if (!tokens || tokens.length === 0) {
    return { success: 0, failure: 0 };
  }
  const m = getMessaging();
  if (!m) {
    return { success: 0, failure: 0 };
  }
  try {
    const message: Record<string, unknown> = {
      tokens,
      notification: { title, body },
      data,
    };

    // High-priority FCM for emergency alerts: bypasses Doze,
    // battery optimization, and app standby. ttl:0 means display
    // immediately even if the app was just opened.
    if (priority === 'high') {
      message.priority = 'high';
      message.ttl = 0;
      // Android-specific: use a dedicated high-importance channel
      // with sound and vibration for emergency alerts.
      message.android = {
        priority: 'high',
        ttl: '0s',
        notification: {
          channelId: 'kavach_emergency',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      };
      // APNs (iOS) headless delivery for critical alerts
      message.apns = {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            'content-available': 1,
            sound: { critical: 1, name: 'default', volume: 1.0 },
          },
        },
      };
    }

    const response = await m.sendEachForMulticast(message);
    // Prune tokens FCM explicitly told us are dead so future sends
    // don't waste a slot on them. Codes vary by SDK version; the
    // two below cover the common "unregistered / invalid" cases.
    if (response.responses && response.responses.length === tokens.length) {
      const deadCodes = new Set([
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
      ]);
      const invalid: string[] = [];
      response.responses.forEach((r, i) => {
        if (!r.success && r.error && r.error.code && deadCodes.has(r.error.code)) {
          invalid.push(tokens[i]);
        }
      });
      if (invalid.length > 0) {
        await removeInvalidTokens(invalid);
      }
    }
    return { success: response.successCount, failure: response.failureCount };
  } catch (e) {
    logger.warn(`FCM multicast push failed (${tokens.length} tokens)`, e as Error);
    return { success: 0, failure: tokens.length };
  }
};

/**
 * Remove FCM tokens that FCM has marked as invalid/unregistered so
 * future sends stop trying them. Best-effort: never throws.
 */
export const removeInvalidTokens = async (
  invalidTokens: string[]
): Promise<void> => {
  if (invalidTokens.length === 0) return;
  try {
    await query(
      `DELETE FROM push_tokens WHERE token = ANY($1::text[])`,
      [invalidTokens]
    );
    logger.info(`Pruned ${invalidTokens.length} invalid push token(s)`);
  } catch (e) {
    logger.warn('Failed to prune invalid push tokens', e as Error);
  }
};