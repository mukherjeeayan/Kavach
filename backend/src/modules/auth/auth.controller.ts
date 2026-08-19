// auth.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';

const respond = (res: Response, status: number, data: unknown, req: Request) => {
  res.status(status).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  });
};

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Returns: 200 with { token, refresh_token, user }
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const session = await authService.login(email, password);
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, child_name?, birth_date? }
 * Returns: 201 with { token, refresh_token, user, child }
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, child_name, birth_date } = req.body;
    const session = await authService.register({
      name,
      email,
      password,
      child_name,
      birth_date,
    });
    respond(res, 201, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/refresh-token
 * Body: { refresh_token }
 * Rotates the refresh token and returns a fresh access token + new
 * refresh token.
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    const session = await authService.refreshAccessToken(refresh_token);
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 * Body: { refresh_token }
 * Revokes the refresh token server-side so it can no longer be rotated.
 * Idempotent — always 200.
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    const result = await authService.logout(refresh_token);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/pin
 * Body: { pin } — authenticated (parent JWT).
 * Sets or rotates the parent's device-unlock PIN.
 */
export const setPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.setParentPin(req.user!.userId, req.body.pin);
    respond(res, 200, { pin_set: true }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/pin/verify
 * Body: { email, pin }
 * Returns 200 with { valid: true, token, user } when the PIN matches
 * (token is a short-lived scoped token); 401 otherwise.
 */
export const verifyPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, pin } = req.body;
    const session = await authService.verifyPin(email, pin);
    respond(res, 200, { valid: true, ...session }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/biometric-token
 * Body: { email, password }
 * Returns a short-lived scoped token for biometric-unlock flows.
 */
export const biometricToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const session = await authService.issueBiometricToken(email, password);
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};