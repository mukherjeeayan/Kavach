// integration.service.test.ts
// Unit tests for the third-party integration management service.

import * as integrationService from '../integration.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as auditService from '../../shared/audit.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
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
const mockedAudit = auditService as jest.Mocked<typeof auditService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const INTEGRATION_ID = '44444444-4444-4444-4444-444444444444';

const integrationRow = {
  id: INTEGRATION_ID,
  parent_id: PARENT_ID,
  integration_type: 'SCHOOL_PORTAL',
  name: 'My School Portal',
  config: { school_id: 'SCH123' },
  is_active: true,
  last_sync_at: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('integration.service', () => {
  describe('listIntegrations', () => {
    it('should return all integrations for a parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [integrationRow] } as any);

      const result = await integrationService.listIntegrations(PARENT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My School Portal');
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM integrations'),
        [PARENT_ID]
      );
    });
  });

  describe('createIntegration', () => {
    it('should insert and audit a new integration', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [integrationRow] } as any);

      const result = await integrationService.createIntegration(PARENT_ID, {
        integration_type: 'SCHOOL_PORTAL',
        name: 'My School Portal',
        config: { school_id: 'SCH123' },
      });

      expect(result.id).toBe(INTEGRATION_ID);
      expect(result.name).toBe('My School Portal');
      // The config column stores an encrypted envelope (not plaintext).
      const storedConfig = JSON.parse((mockedQuery.mock.calls[0][1] as string[])[3]);
      expect(storedConfig._encrypted).toBe(true);
      expect(typeof storedConfig.ct).toBe('string');
      expect(JSON.stringify(storedConfig)).not.toContain('SCH123');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INTEGRATION_CREATED' })
      );
    });
  });

  describe('updateIntegration', () => {
    it('should update and audit an existing integration', async () => {
      const updatedRow = { ...integrationRow, name: 'Updated Portal' };
      mockedQuery.mockResolvedValueOnce({ rows: [updatedRow] } as any);

      const result = await integrationService.updateIntegration(PARENT_ID, INTEGRATION_ID, {
        name: 'Updated Portal',
      });

      expect(result.name).toBe('Updated Portal');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INTEGRATION_UPDATED' })
      );
    });

    it('should throw NotFoundError when integration does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        integrationService.updateIntegration(PARENT_ID, INTEGRATION_ID, { name: 'Nope' })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('deleteIntegration', () => {
    it('should delete and audit an existing integration', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await expect(
        integrationService.deleteIntegration(PARENT_ID, INTEGRATION_ID)
      ).resolves.toBeUndefined();
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INTEGRATION_DELETED' })
      );
    });

    it('should throw NotFoundError when integration does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        integrationService.deleteIntegration(PARENT_ID, INTEGRATION_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('syncIntegration', () => {
    it('should update last_sync_at and audit for an active integration', async () => {
      const selectedRow = { ...integrationRow, config: {} };
      mockedQuery
        .mockResolvedValueOnce({ rows: [selectedRow] } as any)
        .mockResolvedValueOnce({ rowCount: 1 } as any);

      const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

      expect(result.syncedAt).toBeInstanceOf(Date);
      // SELECT first, then UPDATE to record last_sync_at / sync_status
      expect(mockedQuery).toHaveBeenCalledTimes(2);
      expect(mockedQuery.mock.calls[0][0]).toMatch(/SELECT[\s\S]*FROM integrations/);
      expect(mockedQuery.mock.calls[1][0]).toMatch(/UPDATE integrations/);
      expect(mockedQuery.mock.calls[1][0]).toMatch(/last_sync_at\s*=\s*NOW\(\)/);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INTEGRATION_SYNCED' })
      );
    });

    it('should throw NotFoundError when active integration does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });
});
