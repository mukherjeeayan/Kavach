// subscription.routes.ts
// Razorpay webhook endpoint (no JWT auth — Razorpay calls this directly).
// Authenticated endpoints for order creation and feature flags.

import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { authenticateJWT } from '../../middleware/auth';
import * as subscriptionService from './subscription.service';
import logger from '../../utils/logger';

const router = Router();

// ─── Feature flags (public, authenticated) ────────────────────────────────────
router.get(
  '/feature-flags',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flags = await subscriptionService.getPublicFeatureFlags();
      res.json({ success: true, data: flags, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Subscription plans (authenticated) ──────────────────────────────────────
router.get(
  '/plans',
  authenticateJWT,
  async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: subscriptionService.PLANS,
      timestamp: new Date().toISOString(),
    });
  }
);

// ─── Create Razorpay order (authenticated) ────────────────────────────────────
router.post(
  '/checkout/razorpay',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = 'monthly' } = req.body as { period?: 'monthly' | 'yearly' };
      const result = await subscriptionService.createRazorpayOrder(
        req.user!.userId,
        period
      );
      res.json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (err) {
      logger.error('[checkout] Razorpay order creation failed', err);
      next(err);
    }
  }
);

// ─── Razorpay webhook ─────────────────────────────────────────────────────────
router.post(
  '/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

    if (!secret) {
      logger.error('[razorpay webhook] RAZORPAY_WEBHOOK_SECRET is not set');
      return res.status(500).send('Webhook secret not configured');
    }

    const valid = subscriptionService.verifyRazorpayWebhook(req.body as Buffer, signature, secret);
    if (!valid) {
      logger.warn('[razorpay webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    try {
      const event = JSON.parse((req.body as Buffer).toString('utf8')) as Record<string, unknown>;
      await subscriptionService.handleRazorpayEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error('[razorpay webhook] Processing error:', err);
      res.status(500).send('Webhook processing error');
    }
  }
);

export default router;
