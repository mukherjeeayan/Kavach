import { Request, Response, NextFunction } from 'express';
import * as consentService from './parentalConsent.service';

const respond = (res: Response, status: number, data: unknown, req: Request) => {
  res.status(status).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  });
};

export const grant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consent = await consentService.grantConsent(
      req.user!.userId,
      req.params.childId,
      req.body.consent_type,
      req.ip
    );
    respond(res, 201, { consent }, req);
  } catch (err) {
    next(err);
  }
};

export const revoke = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await consentService.revokeConsent(
      req.user!.userId,
      req.params.childId,
      req.body.consent_type
    );
    respond(res, 200, { message: 'Consent revoked' }, req);
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consents = await consentService.listConsents(
      req.user!.userId,
      req.params.childId
    );
    respond(res, 200, { consents }, req);
  } catch (err) {
    next(err);
  }
};

export const check = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const active = await consentService.hasActiveConsent(
      req.params.childId,
      req.params.consentType
    );
    respond(res, 200, { active }, req);
  } catch (err) {
    next(err);
  }
};
