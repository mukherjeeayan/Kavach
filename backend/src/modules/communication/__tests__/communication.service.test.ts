// communication.service.test.ts
// Unit tests for the communication logs service.

import * as communicationService from '../communication.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';
import * as pagination from '../../../utils/pagination';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../../../utils/pagination', () => ({
  toOffset: jest.fn(),
  buildPaginationMeta: jest.fn(),
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
const mockedPagination = pagination as jest.Mocked<typeof pagination>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const ALERT_ID = '55555555-5555-5555-5555-555555555555';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
  mockedPagination.toOffset.mockReturnValue(0);
  mockedPagination.buildPaginationMeta.mockReturnValue({ page: 1, limit: 20, total: 1, total_pages: 1 });
});

describe('communication.service', () => {
  describe('recordCommunications', () => {
    it('should upload entries and return uploaded count', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // device lookup
        .mockResolvedValueOnce({ rows: [] } as any) // keyword dict
        .mockResolvedValueOnce({ rows: [] } as any); // insert log

      const result = await communicationService.recordCommunications(PARENT_ID, DEVICE_ID, [
        { comm_type: 'SMS_IN', contact_number: '+15551234567', content_snippet: 'Hello' },
      ]);

      expect(result.uploaded).toBe(1);
      expect(result.flagged).toBe(0);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO communication_logs'),
        expect.arrayContaining([DEVICE_ID, 'SMS_IN'])
      );
    });

    it('should flag entries matching keyword dictionary', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // device lookup
        .mockResolvedValueOnce({ rows: [{ keyword: 'drugs', category: 'DRUGS', severity: 'HIGH' }] } as any) // keywords
        .mockResolvedValueOnce({ rows: [] } as any) // keyword_alert insert
        .mockResolvedValueOnce({ rows: [] } as any); // communication_log insert

      const result = await communicationService.recordCommunications(PARENT_ID, DEVICE_ID, [
        { comm_type: 'SMS_IN', content_snippet: 'I think we should buy drugs' },
      ]);

      expect(result.flagged).toBe(1);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FLAGGED_COMMUNICATION' })
      );
    });

    it('should throw NotFoundError for invalid device', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        communicationService.recordCommunications(PARENT_ID, DEVICE_ID, [
          { comm_type: 'SMS_IN' },
        ])
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listCommunications', () => {
    it('should verify ownership and return paginated results', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: 'log-1', comm_type: 'SMS_IN' }] } as any) // items
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any); // count

      const result = await communicationService.listCommunications(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('listKeywordAlerts', () => {
    it('should verify ownership and return alerts', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: ALERT_ID, child_id: CHILD_ID, severity: 'HIGH' }],
      } as any);

      const result = await communicationService.listKeywordAlerts(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ALERT_ID);
    });

    it('should filter unreviewed only when requested', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await communicationService.listKeywordAlerts(PARENT_ID, CHILD_ID, true);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_reviewed = FALSE'),
        [CHILD_ID]
      );
    });
  });

  describe('reviewKeywordAlert', () => {
    it('should mark alert as reviewed and return it', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: ALERT_ID, is_reviewed: true }],
      } as any);

      const result = await communicationService.reviewKeywordAlert(PARENT_ID, CHILD_ID, ALERT_ID);

      expect(result.id).toBe(ALERT_ID);
      expect(result.is_reviewed).toBe(true);
    });

    it('should throw NotFoundError for non-existent alert', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        communicationService.reviewKeywordAlert(PARENT_ID, CHILD_ID, ALERT_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
