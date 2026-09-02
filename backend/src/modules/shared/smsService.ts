// smsService.ts
// SMS fallback for emergency alerts when FCM delivery fails.
// Uses Twilio API (free tier: 100 SMS/month) or any compatible SMS gateway.
//
// Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER
// environment variables to enable SMS fallback. When not configured,
// SMS fallback is silently skipped (FCM remains the primary channel).

import logger from '../../utils/logger';

export interface SmsPayload {
  to: string;
  body: string;
}

/**
 * Send an SMS message via Twilio.
 * Returns true on success, false on failure (never throws).
 */
export const sendSms = async (payload: SmsPayload): Promise<boolean> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger.debug('SMS fallback skipped: Twilio credentials not configured');
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({
      To: payload.to,
      From: fromNumber,
      Body: payload.body,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`SMS delivery failed (${response.status}):`, error);
      return false;
    }

    logger.info(`SMS sent successfully to ${payload.to}`);
    return true;
  } catch (err) {
    logger.error('SMS send error:', err);
    return false;
  }
};

/**
 * Send SOS SMS fallback to a list of parent phone numbers.
 * Formats the message with GPS coordinates when available.
 */
export const sendSosSmsFallback = async (
  parentPhoneNumbers: string[],
  childName: string,
  latitude?: number,
  longitude?: number
): Promise<void> => {
  if (parentPhoneNumbers.length === 0) return;

  const locationText = latitude && longitude
    ? ` Location: https://maps.google.com/?q=${latitude},${longitude}`
    : '';

  const message = `EMERGENCY: ${childName} triggered SOS.${locationText} Please check immediately.`;

  const results = await Promise.allSettled(
    parentPhoneNumbers.map((phone) =>
      sendSms({ to: phone, body: message })
    )
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - succeeded;

  if (failed > 0) {
    logger.warn(`SMS fallback: ${failed}/${results.length} messages failed`);
  }

  logger.info(`SMS fallback: ${succeeded}/${results.length} delivered`);
};
