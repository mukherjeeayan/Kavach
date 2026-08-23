import { Request, Response, NextFunction } from 'express';
import * as contactsService from './contacts.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

export const listContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await contactsService.listContacts(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { contacts: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};

export const createContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await contactsService.createContact(req.user!.userId, req.params.childId, req.body);
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await contactsService.updateContact(
      req.user!.userId,
      req.params.childId,
      req.params.contactId,
      req.body
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const deleteContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await contactsService.deleteContact(req.user!.userId, req.params.childId, req.params.contactId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) {
    next(err);
  }
};
