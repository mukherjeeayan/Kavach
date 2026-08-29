// parentalConsent.service.test.ts
// Unit tests for the parental consent service (DPDP Act / COPPA-critical).

import * as consentService from '../parentalConsent.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
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
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedVerify = childrenService.verifyChildBelongsToParent as jest.MockedFunction<
  typeof childrenService.verifyChildBelongsToParent
>;
const mockedAudit = auditService.writeAuditLog as jest.MockedFunction<typeof auditService.writeAuditLog>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';

const consentRow = {
  id: '33333333-3333-3333-3333-333333333333',
  parent_id: PARENT_ID,
  child_id: CHILD_ID,
  consent_type: 'location',
  granted_at: new Date().toISOString(),
  revoked_at: null,
  ip_address: '127.0.0.1',
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('parentalConsent.service', () => {
  describe('grantConsent', () => {
    it('should verify ownership then insert, audit, and return the new consent', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // SELECT existing
        .mockResolvedValueOnce({ rowCount: 0 } as any) // UPDATE revoke old
        .mockResolvedValueOnce({ rows: [consentRow] } as any); // INSERT

      const result = await consentService.grantConsent(PARENT_ID, CHILD_ID, 'location', '127.0.0.1');

      expect(result.consent_type).toBe('location');
      expect(result.revoked_at).toBeNull();
      expect(mockedVerify).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: PARENT_ID,
          targetChildId: CHILD_ID,
          action: 'CONSENT_GRANTED',
        })
      );
    });

    it('should return existing active consent without creating a duplicate', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: consentRow.id }] } as any); // existing found

      const result = await consentService.grantConsent(PARENT_ID, CHILD_ID, 'location');

      expect(result.id).toBe(consentRow.id);
      expect(mockedQuery).toHaveBeenCalledTimes(1); // SELECT only
      expect(mockedQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO parental_consent'),
        expect.anything()
      );
    });

    it('should insert with ip_address when provided', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [consentRow] } as any);

      await consentService.grantConsent(PARENT_ID, CHILD_ID, 'location', '192.168.1.1');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO parental_consent'),
        [PARENT_ID, CHILD_ID, 'location', '192.168.1.1']
      );
    });

    it('should insert with null ip_address when omitted', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [consentRow] } as any);

      await consentService.grantConsent(PARENT_ID, CHILD_ID, 'location');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO parental_consent'),
        [PARENT_ID, CHILD_ID, 'location', null]
      );
    });

    it('should throw when verifyChildBelongsToParent fails', async () => {
      mockedVerify.mockRejectedValue(new Error('Forbidden'));

      await expect(
        consentService.grantConsent(PARENT_ID, CHILD_ID, 'location')
      ).rejects.toThrow('Forbidden');

      expect(mockedQuery).not.toHaveBeenCalled();
    });
  });

  describe('revokeConsent', () => {
    it('should update revoked_at and write an audit log', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rowCount: 1 } as any); // UPDATE

      await consentService.revokeConsent(PARENT_ID, CHILD_ID, 'location');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE parental_consent SET revoked_at'),
        [PARENT_ID, CHILD_ID, 'location']
      );
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONSENT_REVOKED',
        })
      );
    });

    it('should throw NotFoundError when no active consent exists', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        consentService.revokeConsent(PARENT_ID, CHILD_ID, 'location')
      ).rejects.toThrow(NotFoundError);

      expect(mockedAudit).not.toHaveBeenCalled();
    });

    it('should throw when verifyChildBelongsToParent fails', async () => {
      mockedVerify.mockRejectedValue(new Error('Forbidden'));

      await expect(
        consentService.revokeConsent(PARENT_ID, CHILD_ID, 'location')
      ).rejects.toThrow('Forbidden');

      expect(mockedQuery).not.toHaveBeenCalled();
    });
  });

  describe('hasActiveConsent', () => {
    it('should return true when an active consent exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: consentRow.id }] } as any);

      const result = await consentService.hasActiveConsent(CHILD_ID, 'location');

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('revoked_at IS NULL'),
        [CHILD_ID, 'location']
      );
    });

    it('should return false when no active consent exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await consentService.hasActiveConsent(CHILD_ID, 'location');

      expect(result).toBe(false);
    });

    it('should return false when consent was revoked', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await consentService.hasActiveConsent(CHILD_ID, 'app_usage');

      expect(result).toBe(false);
    });
  });

  describe('listConsents', () => {
    it('should verify ownership and return paginated consents with total', async () => {
      const consents = [
        { ...consentRow, consent_type: 'location' },
        { ...consentRow, id: '44444444-4444-4444-4444-444444444444', consent_type: 'app_usage' },
      ];
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: consents } as any) // SELECT items
        .mockResolvedValueOnce({ rows: [{ total: 2 }] } as any); // COUNT

      const result = await consentService.listConsents(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockedVerify).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should return empty list when no consents exist', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

      const result = await consentService.listConsents(PARENT_ID, CHILD_ID);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw when verifyChildBelongsToParent fails', async () => {
      mockedVerify.mockRejectedValue(new Error('Forbidden'));

      await expect(
        consentService.listConsents(PARENT_ID, CHILD_ID)
      ).rejects.toThrow('Forbidden');

      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('should use correct offset for page 2', async () => {
      mockedVerify.mockResolvedValue(undefined);
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 25 }] } as any);

      await consentService.listConsents(PARENT_ID, CHILD_ID, 2, 10);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET $4'),
        [PARENT_ID, CHILD_ID, 10, 10]
      );
    });
  });
});
