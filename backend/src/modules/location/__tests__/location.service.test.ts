// location.service.test.ts
// Unit tests for the GPS ping service.

import * as locationService from '../location.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
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

const pingRow = {
  device_id: DEVICE_ID,
  latitude: 28.6139,
  longitude: 77.209,
  accuracy_m: 12,
  speed_kmh: 0,
  recorded_at: '2026-08-18T10:00:00.000Z',
};

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) also clears queued mockResolvedValueOnce
  // values, so leftover query queues can never leak between tests.
  jest.resetAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('location.service', () => {
  describe('recordLocation', () => {
    it('should reject devices that do not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        locationService.recordLocation(PARENT_ID, DEVICE_ID, {
          latitude: 28.6139,
          longitude: 77.209,
        })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });

    it('should insert the ping and write an audit log', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [] } as any) // INSERT location_logs
        .mockResolvedValueOnce({ rows: [] } as any); // audit log

      await locationService.recordLocation(PARENT_ID, DEVICE_ID, {
        latitude: 28.6139,
        longitude: 77.209,
        accuracy_m: 12,
        speed_kmh: 0,
      });

      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO location_logs'),
        [DEVICE_ID, 28.6139, 77.209, 12, 0, null]
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOCATION_PING', targetChildId: CHILD_ID })
      );
    });
  });

  describe('getCurrentLocations', () => {
    it('should verify ownership and return the latest ping per device', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [pingRow] } as any);

      const result = await locationService.getCurrentLocations(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT ON (device_id)'),
        [CHILD_ID]
      );
    });
  });

  describe('getLocationHistory', () => {
    it('should apply the from/to time filters', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [pingRow] } as any);

      const result = await locationService.getLocationHistory(
        PARENT_ID,
        CHILD_ID,
        '2026-08-18T00:00:00Z',
        '2026-08-18T23:59:59Z',
        50
      );

      expect(result).toHaveLength(1);
      // params order is [childId, limit, from, to] → from is $3, to is $4
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('recorded_at >= $3::timestamptz'),
        [CHILD_ID, 50, '2026-08-18T00:00:00Z', '2026-08-18T23:59:59Z']
      );
    });

    it('should omit time filters when not provided', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [pingRow] } as any);

      await locationService.getLocationHistory(PARENT_ID, CHILD_ID);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY recorded_at DESC'),
        [CHILD_ID, 100]
      );
    });
  });
});