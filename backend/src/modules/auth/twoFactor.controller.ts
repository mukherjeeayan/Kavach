// twoFactor.controller.ts
// Two-Factor Authentication controllers for the auth module.
//
// All authenticated routes derive `parentId` from `req.user.userId` —
// the parent can only ever manage their own 2FA. The body no longer
// carries a parentId, eliminating the previous IDOR.

import { Request, Response, NextFunction } from 'express';
import * as twoFactorService from './twoFactor.service';
import { respond } from '../../utils/response';
import {
  BadRequestError,
  UnauthorizedError,
} from '../../utils/errors';

/**
 * POST /api/v1/auth/2fa/setup — generate QR code and TOTP secret for 2FA enrollment.
 * Authenticated: only the parent can enroll their own account.
 */
export const setup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentId = req.user!.userId;
    const secret = twoFactorService.generateTotpSecret();
    const qrCode = twoFactorService.generateTotpQrCode(secret);
    respond(res, 200, { parentId, secret, qrCode }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/2fa/verify — verify TOTP token during 2FA enrollment.
 * Body: { secret: string, token: string }
 * Authenticated: parentId is taken from the JWT.
 */
export const verify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentId = req.user!.userId;
    const { secret, token } = req.body as { secret?: string; token?: string };

    if (!secret || !token) {
      throw new BadRequestError('secret and token are required');
    }

    const valid = twoFactorService.verifyTotpToken(secret, token);
    if (!valid) {
      throw new UnauthorizedError('Invalid TOTP token');
    }

    respond(res, 200, { valid: true }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/2fa/enable — persist the TOTP secret after the user
 * proves they can produce a valid code. Also mints recovery codes.
 * Body: { secret: string, token: string }
 */
export const enable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentId = req.user!.userId;
    const { secret, token } = req.body as { secret?: string; token?: string };

    if (!secret || !token) {
      throw new BadRequestError('secret and token are required');
    }

    const result = await twoFactorService.enable2FA(parentId, secret, token);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/2fa/disable — turn off 2FA for the authenticated parent.
 */
export const disable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentId = req.user!.userId;
    await twoFactorService.disable2FA(parentId);
    respond(res, 200, { success: true }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/2fa/recovery — get recovery codes for the authenticated parent.
 */
export const recovery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentId = req.user!.userId;
    const codes = await twoFactorService.getRecoveryCodes(parentId);
    respond(res, 200, { recoveryCodes: codes }, req);
  } catch (err) {
    next(err);
  }
};