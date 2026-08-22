// device.service.test.ts
// Unit tests for the device registration service.

import * as deviceService from '../device.service';
import * as childrenService from '../../children/children.service';
import { query } from '../../../config/database';
import { ForbiddenError, NotFoundError } from '../../../utils/errors';

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

const deviceRow = {
  device_id: DEVICE_ID,
  child_id: CHILD_ID,
  device_name: 'Kid\'s Phone',
  device_type: 'android',
  os_version: '15',
  fcm_token: 'fcm-token',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('device.service', () => {
  describe('registerDevice', () => {
    it('should verify ownership, insert and audit a new device', async () => {
      // verifyChildBelongsToParent query
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // INSERT devices
      mockedQuery.mockResolvedValueOnce({ rows: [deviceRow] } as any);
      // INSERT audit_logs
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await deviceService.registerDevice(PARENT_ID, {
        child_id: CHILD_ID,
        device_name: 'Kid\'s Phone',
        device_type: 'android',
        os_version: '15',
        fcm_token: 'fcm-token',
      });

      expect(result.device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO devices'),
        expect.arrayContaining([CHILD_ID, 'Kid\'s Phone', 'android'])
      );
    });

    it('should throw ForbiddenError when the child does not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceService.registerDevice(PARENT_ID, {
          child_id: CHILD_ID,
          device_name: 'Kid\'s Phone',
          device_type: 'android',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should update an existing device (idempotent re-registration)', async () => {
      // verifyChildBelongsToParent
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // SELECT existing device
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
      // UPDATE devices
      mockedQuery.mockResolvedValueOnce({ rows: [deviceRow] } as any);

      const result = await deviceService.registerDevice(PARENT_ID, {
        child_id: CHILD_ID,
        device_id: DEVICE_ID,
        device_name: 'Kid\'s Phone',
        device_type: 'android',
      });

      expect(result.device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE devices'),
        expect.arrayContaining([DEVICE_ID])
      );
    });

    it('should throw ForbiddenError when the existing device belongs to another child', async () => {
      // verifyChildBelongsToParent
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // SELECT existing device (belongs to a different child)
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: DEVICE_ID, child_id: '99999999-9999-9999-9999-999999999999' }],
      } as any);

      await expect(
        deviceService.registerDevice(PARENT_ID, {
          child_id: CHILD_ID,
          device_id: DEVICE_ID,
          device_name: 'Kid\'s Phone',
          device_type: 'android',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should create a new device when the provided device_id is unknown', async () => {
      // verifyChildBelongsToParent
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // SELECT existing device (none)
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      // INSERT devices
      mockedQuery.mockResolvedValueOnce({ rows: [deviceRow] } as any);
      // INSERT audit_logs
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await deviceService.registerDevice(PARENT_ID, {
        child_id: CHILD_ID,
        device_id: DEVICE_ID,
        device_name: 'Kid\'s Phone',
        device_type: 'android',
      });

      expect(result.device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO devices'),
        expect.anything()
      );
    });
  });

  describe('touchDevice', () => {
    it('should update last_active for a device the parent owns', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await expect(
        deviceService.touchDevice(PARENT_ID, DEVICE_ID)
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for an unknown or foreign device', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        deviceService.touchDevice(PARENT_ID, DEVICE_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('setDeviceAdminStatus', () => {
    const adminRow = {
      ...deviceRow,
      admin_active: true,
      last_active: new Date().toISOString(),
    };

    it('should update admin_active and audit the change', async () => {
      // SELECT device ownership
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
      // UPDATE devices
      mockedQuery.mockResolvedValueOnce({ rows: [adminRow] } as any);
      // INSERT audit_logs
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await deviceService.setDeviceAdminStatus(PARENT_ID, DEVICE_ID, true);

      expect(result.admin_active).toBe(true);
      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE devices'),
        [true, DEVICE_ID]
      );
      expect(mockedQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.anything()
      );
    });

    it('should audit admin deactivation (a bypass signal)', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
      mockedQuery.mockResolvedValueOnce({
        rows: [{ ...adminRow, admin_active: false }],
      } as any);
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await deviceService.setDeviceAdminStatus(PARENT_ID, DEVICE_ID, false);

      expect(result.admin_active).toBe(false);
      expect(mockedQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO audit_logs'),
        [
          PARENT_ID,
          CHILD_ID,
          'DEVICE_ADMIN_STATUS',
          'device',
          expect.stringContaining('"admin_active":false'),
        ]
      );
    });

    it('should throw NotFoundError when the device does not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceService.setDeviceAdminStatus(PARENT_ID, DEVICE_ID, true)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateFcmToken', () => {
    it('should refresh the token and last_active for an owned device', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
      mockedQuery.mockResolvedValueOnce({
        rows: [{ ...deviceRow, fcm_token: 'new-token' }],
      } as any);

      const result = await deviceService.updateFcmToken(PARENT_ID, DEVICE_ID, 'new-token');

      expect(result.fcm_token).toBe('new-token');
      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE devices'),
        ['new-token', DEVICE_ID]
      );
    });

    it('should clear the token when null is sent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
      mockedQuery.mockResolvedValueOnce({
        rows: [{ ...deviceRow, fcm_token: null }],
      } as any);

      const result = await deviceService.updateFcmToken(PARENT_ID, DEVICE_ID, null);

      expect(result.fcm_token).toBeNull();
    });

    it('should throw NotFoundError when the device does not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceService.updateFcmToken(PARENT_ID, DEVICE_ID, 'token')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listDevicesForChild', () => {
    it('should verify ownership and return the child\'s devices', async () => {
      // verifyChildBelongsToParent
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // COUNT devices
      mockedQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] } as any);
      // SELECT devices
      mockedQuery.mockResolvedValueOnce({ rows: [deviceRow] } as any);

      const result = await deviceService.listDevicesForChild(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM devices'),
        expect.arrayContaining([CHILD_ID])
      );
    });

    it('should throw ForbiddenError when the child does not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        deviceService.listDevicesForChild(PARENT_ID, CHILD_ID)
      ).rejects.toThrow(ForbiddenError);
    });
  });
});