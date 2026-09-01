// subscription.service.ts
// Handles payment gateway webhooks from Razorpay.
// On a successful payment event, this service upgrades the user's tier
// and records the payment in subscription_payments.
// Also creates Razorpay orders for frontend-initiated payments.

import crypto from 'crypto';
import { query } from '../../config/database';
import logger from '../../utils/logger';

export type Gateway = 'razorpay';

// ─── Plan configuration ───────────────────────────────────────────────────────

export interface PlanConfig {
  name: string;
  price_monthly: number;   // in smallest currency unit (paise)
  price_yearly: number;    // in smallest currency unit
  currency: string;        // ISO 4217
  razorpay_plan_monthly?: string;
  razorpay_plan_yearly?: string;
}

export const PLANS: Record<string, PlanConfig> = {
  premium: {
    name: 'Kavach Premium',
    price_monthly: 29900,  // ₹299
    price_yearly: 249900,  // ₹2499
    currency: 'inr',
    razorpay_plan_monthly: process.env.RAZORPAY_PLAN_MONTHLY ?? '',
    razorpay_plan_yearly: process.env.RAZORPAY_PLAN_YEARLY ?? '',
  },
};

// ─── Razorpay order creation ──────────────────────────────────────────────────

export const createRazorpayOrder = async (
  parentId: string,
  period: 'monthly' | 'yearly'
): Promise<{ order_id: string; amount: number; currency: string; key: string }> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Razorpay = require('razorpay').default ?? require('razorpay');
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID ?? '',
    key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
  });

  const plan = PLANS.premium;
  const amount = period === 'yearly' ? plan.price_yearly : plan.price_monthly;

  const order = await razorpay.orders.create({
    amount,
    currency: plan.currency.toUpperCase(),
    receipt: `kavach_premium_${parentId}_${period}`,
    notes: { parent_id: parentId, plan: 'premium', period },
  });

  logger.info(`[razorpay] Order created for parent ${parentId}: ${order.id}`);
  return {
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.RAZORPAY_KEY_ID ?? '',
  };
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const upgradeToPremium = async (
  parentId: string,
  gatewayRef: string,
  gateway: Gateway,
  gatewayEvent: string,
  amountMinor: number | null,
  currency: string | null,
  periodStart: Date | null,
  periodEnd: Date | null,
  rawPayload: unknown
) => {
  await query(
    `UPDATE parents
     SET subscription_tier = 'PREMIUM', trial_expires_at = NULL, subscription_updated_at = now()
     WHERE id = $1`,
    [parentId]
  );

  await query(
    `INSERT INTO subscription_payments
       (parent_id, gateway, gateway_event, gateway_ref, amount_minor, currency,
        tier_granted, period_start, period_end, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, 'PREMIUM', $7, $8, $9)`,
    [parentId, gateway, gatewayEvent, gatewayRef, amountMinor, currency,
     periodStart?.toISOString() ?? null, periodEnd?.toISOString() ?? null,
     JSON.stringify(rawPayload)]
  );

  logger.info(`[subscriptions] Upgraded parent ${parentId} to PREMIUM via ${gateway}`);
};

const downgradeToFree = async (parentId: string) => {
  await query(
    `UPDATE parents
     SET subscription_tier = 'FREE', trial_expires_at = NULL, subscription_updated_at = now()
     WHERE id = $1`,
    [parentId]
  );
  logger.info(`[subscriptions] Downgraded parent ${parentId} to FREE`);
};

// ─── Razorpay webhook verification ──────────────────────────────────────────────

export const verifyRazorpayWebhook = (
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean => {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

export const handleRazorpayEvent = async (event: Record<string, unknown>): Promise<void> => {
  const eventName = event.event as string;
  const payload = (event.payload as Record<string, unknown>) ?? {};
  const payment = (payload.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
  const subscription = (payload.subscription as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
  const parentId = (payment?.notes as Record<string, string>)?.parent_id;

  if (!parentId) {
    logger.warn(`[razorpay] No parent_id in notes for event ${eventName}`);
    return;
  }

  if (eventName === 'payment.captured' || eventName === 'subscription.activated') {
    const amount = payment?.amount as number | null ?? null;
    const currency = payment?.currency as string | null ?? null;
    const ref = payment?.id as string ?? subscription?.id as string ?? '';
    const periodStart = subscription?.current_start
      ? new Date((subscription.current_start as number) * 1000)
      : null;
    const periodEnd = subscription?.current_end
      ? new Date((subscription.current_end as number) * 1000)
      : null;
    await upgradeToPremium(
      parentId, ref, 'razorpay', eventName,
      amount, currency, periodStart, periodEnd, event
    );
  } else if (eventName === 'subscription.cancelled' || eventName === 'subscription.halted') {
    await downgradeToFree(parentId);
  }
};

// ─── Feature flag lookup (used by frontend to know which features are available) ──

export const getPublicFeatureFlags = async (): Promise<
  { key: string; is_enabled: boolean; required_tier: string }[]
> => {
  const result = await query(
    `SELECT key, is_enabled, required_tier FROM feature_flags ORDER BY key ASC`
  );
  return result.rows as { key: string; is_enabled: boolean; required_tier: string }[];
};
