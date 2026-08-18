// auth.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';

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
 * POST /api/v1/auth/refresh-token
 * Body: { refresh_token }
 * Returns: 200 with { token }
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    const token = authService.refreshAccessToken(refresh_token);
    respond(res, 200, { token }, req);
  } catch (err) {
    next(err);
  }
};