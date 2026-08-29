// contacts.service.test.ts
// Unit tests for the contact rule CRUD service.

import * as contactsService from '../contacts.service';
import { query } from '../../../config/database';
import * as childrenService from '../../children/children.service';
import { NotFoundError } from '../../../utils/errors';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
  ensureDeviceBelongsToChild: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const CONTACT_ID = '33333333-3333-3333-3333-333333333333';
const DEVICE_ID = '44444444-4444-4444-4444-444444444444';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedChildren.ensureDeviceBelongsToChild.mockResolvedValue(undefined);
});

describe('contacts.service', () => {
  describe('listContacts', () => {
    it('should return paginated contact rules for the child', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 2 }] } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: CONTACT_ID, phone_number: '+15551234567', rule_type: 'BLOCK' },
            { id: 'other-id', phone_number: '+15559876543', rule_type: 'ALLOW' },
          ],
        } as any);

      const result = await contactsService.listContacts(PARENT_ID, CHILD_ID);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)::int AS total FROM contact_rules'),
        [CHILD_ID]
      );
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM contact_rules'),
        [CHILD_ID, 20, 0]
      );
    });
  });

  describe('createContact', () => {
    it('should insert and return the contact with audit log', async () => {
      const createdRow = {
        id: CONTACT_ID,
        child_id: CHILD_ID,
        phone_number: '+15551234567',
        contact_name: 'Spam',
        rule_type: 'BLOCK',
        is_active: true,
      };

      mockedQuery.mockResolvedValueOnce({ rows: [createdRow] } as any);

      const result = await contactsService.createContact(PARENT_ID, CHILD_ID, {
        phone_number: '+15551234567',
        contact_name: 'Spam',
        rule_type: 'BLOCK',
        device_id: DEVICE_ID,
      });

      expect(result).toEqual(createdRow);
      expect(mockedChildren.ensureDeviceBelongsToChild).toHaveBeenCalledWith(CHILD_ID, DEVICE_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contact_rules'),
        [CHILD_ID, DEVICE_ID, '+15551234567', 'Spam', 'BLOCK']
      );
    });
  });

  describe('updateContact', () => {
    it('should update fields and return the updated contact', async () => {
      const updatedRow = {
        id: CONTACT_ID,
        child_id: CHILD_ID,
        contact_name: 'Updated',
        rule_type: 'ALLOW',
        is_active: false,
      };

      mockedQuery.mockResolvedValueOnce({ rows: [updatedRow] } as any);

      const result = await contactsService.updateContact(PARENT_ID, CHILD_ID, CONTACT_ID, {
        contact_name: 'Updated',
        rule_type: 'ALLOW',
        is_active: false,
      });

      expect(result).toEqual(updatedRow);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contact_rules'),
        expect.arrayContaining([CONTACT_ID, CHILD_ID])
      );
    });

    it('should throw NotFoundError when no contact exists for the child', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        contactsService.updateContact(PARENT_ID, CHILD_ID, 'nonexistent', {
          contact_name: 'X',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteContact', () => {
    it('should delete the contact when it exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await expect(
        contactsService.deleteContact(PARENT_ID, CHILD_ID, CONTACT_ID)
      ).resolves.toBeUndefined();

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM contact_rules'),
        [CONTACT_ID, CHILD_ID]
      );
    });

    it('should throw NotFoundError when nothing was deleted', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        contactsService.deleteContact(PARENT_ID, CHILD_ID, 'nonexistent')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
