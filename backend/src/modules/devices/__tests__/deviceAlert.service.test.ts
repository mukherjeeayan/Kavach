// deviceAlert.service.test.ts
// Unit tests for the tamper-alert reporting service.

import * as deviceAlertService from '../deviceAlert.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';

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

const mockedQuery = query as jest.MockedFunction<typeof query>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('deviceAlert.service', () => {
  describe('reportTamperAlert', () => {
    it('should verify device ownership and persist the alert in audit_logs', async () => {
      // Ownership check: device belongs to the parent's child
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any);
      // INSERT audit_logs
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceAlertService.reportTamperAlert(PARENT_ID, DEVICE_ID, 'root detected')
      ).resolves.toBeUndefined();

      expect(mockedQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FROM devices d'),
        [DEVICE_ID, PARENT_ID]
      );
      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO audit_logs'),
        [
          PARENT_ID,
          null,
          'TAMPER_ALERT',
          'device',
          JSON.stringify({ device_id: DEVICE_ID, details: 'root detected' }),
        ]
      );
    });

    it('should throw NotFoundError when the device does not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceAlertService.reportTamperAlert(PARENT_ID, DEVICE_ID, 'root detected')
      ).rejects.toThrow(NotFoundError);
      // No audit log may be written for an unverified device
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });
  });
});