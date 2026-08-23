import { Request, Response, NextFunction } from 'express';
import * as consentService from './parentalConsent.service';
import { respond } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';

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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await consentService.listConsents(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { consents: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const check = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verifyChildBelongsToParent } = await import('../children/children.service');
    await verifyChildBelongsToParent(req.params.childId, req.user!.userId);

    const active = await consentService.hasActiveConsent(
      req.params.childId,
      req.params.consentType
    );
    respond(res, 200, { active }, req);
  } catch (err) {
    next(err);
  }
};
