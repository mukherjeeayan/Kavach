import { Request, Response, NextFunction } from 'express';
import * as contactsService from './contacts.service';
import { buildPaginationMeta } from '../../utils/pagination';

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
    res.status(200).json({
      success: true,
      data: { contacts: items, pagination: buildPaginationMeta(page, limit, total) },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

export const createContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await contactsService.createContact(req.user!.userId, req.params.childId, req.body);
    res.status(201).json({
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
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
    res.status(200).json({
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};

export const deleteContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await contactsService.deleteContact(req.user!.userId, req.params.childId, req.params.contactId);
    res.status(200).json({
      success: true,
      data: { deleted: true },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'],
    });
  } catch (err) {
    next(err);
  }
};
