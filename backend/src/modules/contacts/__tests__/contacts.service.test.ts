// contacts.service.test.ts
// Unit tests for the contact allow/block rules service.

import * as contactsService from '../contacts.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
  ensureDeviceBelongsToChild: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;
const mockedAudit = auditService as jest.Mocked<typeof auditService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const CONTACT_ID = '44444444-4444-4444-4444-444444444444';

const contactRow = {
  id: CONTACT_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  phone_number: '+15551234567',
  contact_name: 'Grandma',
  rule_type: 'ALLOW',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedChildren.ensureDeviceBelongsToChild.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('contacts.service', () => {
  describe('listContacts', () => {
    it('should verify ownership and return rules with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any) // COUNT
        .mockResolvedValueOnce({ rows: [contactRow] } as any); // SELECT page

      const result = await contactsService.listContacts(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('createContact', () => {
    it('should insert, audit and default rule_type to BLOCK', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [contactRow] } as any);

      const result = await contactsService.createContact(PARENT_ID, CHILD_ID, {
        phone_number: '+15551234567',
        contact_name: 'Grandma',
      });

      expect(result.id).toBe(CONTACT_ID);
      expect(mockedChildren.ensureDeviceBelongsToChild).toHaveBeenCalledWith(CHILD_ID, undefined);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contact_rules'),
        [CHILD_ID, null, '+15551234567', 'Grandma', 'BLOCK']
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_CONTACT', targetChildId: CHILD_ID })
      );
    });
  });

  describe('updateContact', () => {
    it('should update and audit an existing rule', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ ...contactRow, is_active: false }] } as any);

      const result = await contactsService.updateContact(PARENT_ID, CHILD_ID, CONTACT_ID, {
        is_active: false,
      });

      expect(result.is_active).toBe(false);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contact_rules'),
        expect.arrayContaining([CONTACT_ID, CHILD_ID])
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_CONTACT' })
      );
    });

    it('should throw NotFoundError when the rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        contactsService.updateContact(PARENT_ID, CHILD_ID, CONTACT_ID, { is_active: false })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('deleteContact', () => {
    it('should delete and audit an existing rule', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await expect(
        contactsService.deleteContact(PARENT_ID, CHILD_ID, CONTACT_ID)
      ).resolves.toBeUndefined();
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_CONTACT' })
      );
    });

    it('should throw NotFoundError when the rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        contactsService.deleteContact(PARENT_ID, CHILD_ID, CONTACT_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });
});