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
    const tokens = devices.rows.map((r: { fcm_token: string }) => r.fcm_token);
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