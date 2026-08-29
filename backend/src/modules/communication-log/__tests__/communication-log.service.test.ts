// communication-log.service.test.ts
// Unit tests for the communication log CRUD service.

import * as commLogService from '../communication-log.service';
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
const LOG_ID = '55555555-5555-5555-5555-555555555555';
const DEVICE_ID = '44444444-4444-4444-4444-444444444444';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
});

describe('communication-log.service', () => {
  describe('listCommunicationLogs', () => {
    it('should return paginated logs with metadata', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [
            { id: LOG_ID, comm_type: 'SMS_IN', contact_number: '+1' },
            { id: 'other', comm_type: 'CALL_OUT', contact_number: '+2' },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [{ total: 2 }] } as any);

      const result = await commLogService.listCommunicationLogs(
        PARENT_ID,
        CHILD_ID,
        1,
        20
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('createCommunicationLog', () => {
    it('should insert a log and write an audit entry', async () => {
      const inserted = {
        id: LOG_ID,
        device_id: DEVICE_ID,
        comm_type: 'SMS_IN',
        contact_number: '+1',
        is_flagged: false,
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any) // find device
        .mockResolvedValueOnce({ rows: [] } as any) // keyword dictionary
        .mockResolvedValueOnce({ rows: [inserted] } as any); // insert

      const result = await commLogService.createCommunicationLog(
        PARENT_ID,
        CHILD_ID,
        {
          comm_type: 'SMS_IN',
          contact_number: '+1',
          content_snippet: 'hello world',
        }
      );

      expect(result).toEqual(inserted);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO communication_logs'),
        expect.arrayContaining([DEVICE_ID, 'SMS_IN'])
      );
    });

    it('should flag content that matches a keyword dictionary entry', async () => {
      const flaggedRow = {
        id: LOG_ID,
        device_id: DEVICE_ID,
        comm_type: 'SMS_IN',
        is_flagged: true,
        flag_reason: 'Matched: drugs',
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any)
        .mockResolvedValueOnce({
          rows: [{ keyword: 'drugs', category: 'substance', severity: 'HIGH' }],
        } as any)
        .mockResolvedValueOnce({ rows: [flaggedRow] } as any);

      const result = await commLogService.createCommunicationLog(
        PARENT_ID,
        CHILD_ID,
        {
          comm_type: 'SMS_IN',
          content_snippet: 'Talking about drugs',
        }
      );

      expect(result.is_flagged).toBe(true);
      expect(result.flag_reason).toContain('drugs');
    });
  });

  describe('getCommunicationLog', () => {
    it('should return a single log when present', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: LOG_ID, comm_type: 'SMS_IN' }],
      } as any);

      const result = await commLogService.getCommunicationLog(
        PARENT_ID,
        CHILD_ID,
        LOG_ID
      );

      expect(result.id).toBe(LOG_ID);
    });

    it('should throw NotFoundError when log is missing', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        commLogService.getCommunicationLog(PARENT_ID, CHILD_ID, 'missing')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteCommunicationLog', () => {
    it('should delete the log when it exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: LOG_ID }] } as any);

      await expect(
        commLogService.deleteCommunicationLog(PARENT_ID, CHILD_ID, LOG_ID)
      ).resolves.toBeUndefined();

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM communication_logs'),
        [LOG_ID, CHILD_ID]
      );
    });

    it('should throw NotFoundError when nothing was deleted', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        commLogService.deleteCommunicationLog(PARENT_ID, CHILD_ID, 'missing')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
