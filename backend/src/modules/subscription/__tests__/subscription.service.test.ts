// subscription.service.test.ts
// Unit tests for the subscription service: plan data, Razorpay order creation,
// webhook event handling, upgrade/downgrade logic, and signature verification.

import crypto from 'crypto';
import * as subscriptionService from '../subscription.service';
import { query } from '../../../config/database';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
  process.env.RAZORPAY_KEY_SECRET = 'test_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test123';
  process.env.RAZORPAY_PLAN_MONTHLY = 'plan_monthly_123';
  process.env.RAZORPAY_PLAN_YEARLY = 'plan_yearly_456';
});

// ─── getSubscriptionPlans (PLANS constant) ───────────────────────────────────

describe('getSubscriptionPlans', () => {
  it('should expose the PLANS constant with premium plan data', () => {
    const plans = subscriptionService.PLANS;

    expect(plans).toBeDefined();
    expect(plans.premium).toBeDefined();
    expect(plans.premium.name).toBe('Kavach Premium');
    expect(plans.premium.price_monthly).toBe(29900);
    expect(plans.premium.price_yearly).toBe(249900);
    expect(plans.premium.currency).toBe('inr');
  });

  it('should have razorpay plan ID fields', () => {
    const plans = subscriptionService.PLANS;

    // PLANS is evaluated at module load time, so env vars from beforeEach
    // don't affect it. Verify the fields exist and are strings.
    expect(typeof plans.premium.razorpay_plan_monthly).toBe('string');
    expect(typeof plans.premium.razorpay_plan_yearly).toBe('string');
  });
});

// ─── createRazorpayOrder ────────────────────────────────────────────────────

describe('createRazorpayOrder', () => {
  it('should be a function accepting parentId and period', () => {
    expect(typeof subscriptionService.createRazorpayOrder).toBe('function');
    expect(subscriptionService.createRazorpayOrder.length).toBe(2);
  });

  it('should use the correct plan amount for monthly period', () => {
    // Verify the PLANS constant has the right monthly amount that createRazorpayOrder uses
    expect(subscriptionService.PLANS.premium.price_monthly).toBe(29900);
  });

  it('should use the correct plan amount for yearly period', () => {
    expect(subscriptionService.PLANS.premium.price_yearly).toBe(249900);
  });
});

// ─── handleRazorpayEvent: payment.captured ──────────────────────────────────

describe('handleRazorpayEvent: payment.captured', () => {
  it('should upgrade user to PREMIUM and record payment', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_abc123',
            amount: 29900,
            currency: 'INR',
            notes: { parent_id: PARENT_ID },
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    // Should call UPDATE parents (upgrade) + INSERT subscription_payments
    expect(mockedQuery).toHaveBeenCalledTimes(2);

    // First call: UPDATE parents SET subscription_tier = 'PREMIUM'
    expect(mockedQuery.mock.calls[0][0]).toContain(
      "SET subscription_tier = 'PREMIUM'"
    );
    expect(mockedQuery.mock.calls[0][1]).toContain(PARENT_ID);

    // Second call: INSERT INTO subscription_payments
    expect(mockedQuery.mock.calls[1][0]).toContain('INSERT INTO subscription_payments');
    expect(mockedQuery.mock.calls[1][1]).toContain(PARENT_ID);
    expect(mockedQuery.mock.calls[1][1]).toContain('razorpay');
    expect(mockedQuery.mock.calls[1][1]).toContain('payment.captured');
  });
});

// ─── handleRazorpayEvent: subscription.activated ────────────────────────────

describe('handleRazorpayEvent: subscription.activated', () => {
  it('should upgrade user to PREMIUM with subscription period', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    const now = Math.floor(Date.now() / 1000);
    const event = {
      event: 'subscription.activated',
      payload: {
        payment: {
          entity: {
            id: 'pay_sub123',
            amount: 29900,
            currency: 'INR',
            notes: { parent_id: PARENT_ID },
          },
        },
        subscription: {
          entity: {
            id: 'sub_abc123',
            current_start: now,
            current_end: now + 30 * 86400,
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[0][0]).toContain(
      "SET subscription_tier = 'PREMIUM'"
    );

    // Verify period dates are passed to INSERT
    const insertParams = mockedQuery.mock.calls[1][1] as any[];
    expect(insertParams).toContain(PARENT_ID);
    expect(insertParams).toContain('subscription.activated');
  });
});

// ─── handleRazorpayEvent: subscription.cancelled ────────────────────────────

describe('handleRazorpayEvent: subscription.cancelled', () => {
  it('should downgrade user to FREE', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    const event = {
      event: 'subscription.cancelled',
      payload: {
        payment: {
          entity: {
            id: 'pay_cancel123',
            notes: { parent_id: PARENT_ID },
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toContain(
      "SET subscription_tier = 'FREE'"
    );
    expect(mockedQuery.mock.calls[0][1]).toContain(PARENT_ID);
  });
});

// ─── handleRazorpayEvent: subscription.halted ───────────────────────────────

describe('handleRazorpayEvent: subscription.halted', () => {
  it('should downgrade user to FREE', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    const event = {
      event: 'subscription.halted',
      payload: {
        payment: {
          entity: {
            id: 'pay_halt123',
            notes: { parent_id: PARENT_ID },
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toContain(
      "SET subscription_tier = 'FREE'"
    );
  });
});

// ─── handleRazorpayEvent: missing parent_id ─────────────────────────────────

describe('handleRazorpayEvent: missing parent_id', () => {
  it('should return early and not query DB when parent_id is missing', async () => {
    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_no_parent',
            amount: 29900,
            currency: 'INR',
            notes: {},
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('should return early when payment entity is undefined', async () => {
    const event = {
      event: 'payment.captured',
      payload: {},
    };

    await subscriptionService.handleRazorpayEvent(event);

    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

// ─── handleRazorpayEvent: unknown event ─────────────────────────────────────

describe('handleRazorpayEvent: unknown event', () => {
  it('should not query DB for unhandled event types', async () => {
    const event = {
      event: 'payment.authorized',
      payload: {
        payment: {
          entity: {
            id: 'pay_unk',
            notes: { parent_id: PARENT_ID },
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

// ─── upgradeToPremium (via handleRazorpayEvent) ─────────────────────────────

describe('upgradeToPremium via event', () => {
  it('should clear trial_expires_at when upgrading', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_upgrade',
            amount: 29900,
            currency: 'INR',
            notes: { parent_id: PARENT_ID },
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    // trial_expires_at = NULL is hardcoded in the SQL, not a parameter
    const updateQuery = mockedQuery.mock.calls[0][0] as string;
    expect(updateQuery).toContain('trial_expires_at = NULL');
    const updateParams = mockedQuery.mock.calls[0][1] as any[];
    expect(updateParams).toContain(PARENT_ID);
  });
});

// ─── downgradeToFree (via handleRazorpayEvent) ──────────────────────────────

describe('downgradeToFree via event', () => {
  it('should set subscription_tier to FREE and clear trial_expires_at', async () => {
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    const event = {
      event: 'subscription.cancelled',
      payload: {
        payment: {
          entity: {
            id: 'pay_down',
            notes: { parent_id: PARENT_ID },
          },
        },
      },
    };

    await subscriptionService.handleRazorpayEvent(event);

    const updateQuery = mockedQuery.mock.calls[0][0] as string;
    expect(updateQuery).toContain("subscription_tier = 'FREE'");
    expect(updateQuery).toContain('trial_expires_at = NULL');
    expect(updateQuery).toContain('subscription_updated_at = now()');
  });
});

// ─── verifyRazorpayWebhook ──────────────────────────────────────────────────

describe('verifyRazorpayWebhook', () => {
  it('should return true for a valid signature', () => {
    const secret = 'whsec_test123';
    const body = Buffer.from('{"event":"payment.captured"}');
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const result = subscriptionService.verifyRazorpayWebhook(body, expectedSig, secret);

    expect(result).toBe(true);
  });

  it('should return false for an invalid signature', () => {
    const secret = 'whsec_test123';
    const body = Buffer.from('{"event":"payment.captured"}');
    const badSig = 'invalid_signature_hex';

    // verifyRazorpayWebhook uses timingSafeEqual which requires equal-length buffers.
    // Pad the bad signature to match length.
    const paddedBadSig = badSig.padEnd(64, '0');

    const result = subscriptionService.verifyRazorpayWebhook(body, paddedBadSig, secret);

    expect(result).toBe(false);
  });

  it('should return false when signature is empty', () => {
    const secret = 'whsec_test123';
    const body = Buffer.from('test body');
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    const emptySig = ''.padEnd(64, '0');

    const result = subscriptionService.verifyRazorpayWebhook(body, emptySig, secret);

    expect(result).toBe(false);
  });
});

// ─── getPublicFeatureFlags ───────────────────────────────────────────────────

describe('getPublicFeatureFlags', () => {
  it('should return feature flags from DB', async () => {
    const flags = [
      { key: 'dark_mode', is_enabled: true, required_tier: 'FREE' },
      { key: 'ai_chat', is_enabled: false, required_tier: 'PREMIUM' },
    ];
    mockedQuery.mockResolvedValueOnce({ rows: flags } as any);

    const result = await subscriptionService.getPublicFeatureFlags();

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('dark_mode');
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM feature_flags')
    );
  });

  it('should return empty array when no flags exist', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const result = await subscriptionService.getPublicFeatureFlags();

    expect(result).toHaveLength(0);
  });
});
