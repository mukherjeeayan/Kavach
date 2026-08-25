// deviceHealth.service.test.ts
// Unit tests for the device health telemetry service.

import * as deviceHealthService from '../deviceHealth.service';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('deviceHealth.service', () => {
  describe('recordHealth', () => {
    it('should insert a health snapshot for a valid device', async () => {
      const healthRow = {
        id: 'health-1',
        device_id: DEVICE_ID,
        battery_level: 85,
        is_charging: false,
        is_rooted: false,
        is_usb_debugging: false,
      };
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // device lookup
        .mockResolvedValueOnce({ rows: [healthRow] } as any); // insert

      const result = await deviceHealthService.recordHealth(PARENT_ID, DEVICE_ID, {
        battery_level: 85,
        is_charging: false,
        os_version: '14',
      });

      expect(result.battery_level).toBe(85);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO device_health_logs'),
        expect.arrayContaining([DEVICE_ID, 85, false])
      );
    });

    it('should write a security alert when device is rooted', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'h1', device_id: DEVICE_ID, is_rooted: true }] } as any);

      await deviceHealthService.recordHealth(PARENT_ID, DEVICE_ID, {
        is_rooted: true,
        is_usb_debugging: false,
      });

      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEVICE_SECURITY_ALERT',
          details: expect.objectContaining({ is_rooted: true }),
        })
      );
    });

    it('should write a security alert when USB debugging is enabled', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'h1', device_id: DEVICE_ID, is_usb_debugging: true }] } as any);

      await deviceHealthService.recordHealth(PARENT_ID, DEVICE_ID, {
        is_rooted: false,
        is_usb_debugging: true,
      });

      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEVICE_SECURITY_ALERT',
          details: expect.objectContaining({ is_usb_debugging: true }),
        })
      );
    });

    it('should throw NotFoundError for invalid device', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceHealthService.recordHealth(PARENT_ID, DEVICE_ID, { battery_level: 50 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getLatestHealth', () => {
    it('should verify ownership and return the latest snapshot', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: 'h1', device_id: DEVICE_ID, battery_level: 70 }],
      } as any);

      const result = await deviceHealthService.getLatestHealth(PARENT_ID, CHILD_ID, DEVICE_ID);

      expect(result.battery_level).toBe(70);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should return null when no health data exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await deviceHealthService.getLatestHealth(PARENT_ID, CHILD_ID, DEVICE_ID);

      expect(result).toBeNull();
    });
  });

  describe('getHealthHistory', () => {
    it('should verify ownership and return health history', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'h1', battery_level: 80 },
          { id: 'h2', battery_level: 60 },
        ],
      } as any);

      const result = await deviceHealthService.getHealthHistory(PARENT_ID, CHILD_ID, DEVICE_ID, 48);

      expect(result).toHaveLength(2);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        [DEVICE_ID, 48]
      );
    });
  });
});
