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
    it('should verify ownership before creating a new device', async () => {
      // verifyChildBelongsToParent query
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // INSERT devices
      mockedQuery.mockResolvedValueOnce({ rows: [deviceRow] } as any);

      const result = await deviceService.registerDevice(PARENT_ID, {
        child_id: CHILD_ID,
        device_name: 'Kid\'s Phone',
        device_type: 'android',
        os_version: '15',
        fcm_token: 'fcm-token',
      });

      expect(result.device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
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
      expect(mockedQuery).toHaveBeenLastCalledWith(
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

      const result = await deviceService.registerDevice(PARENT_ID, {
        child_id: CHILD_ID,
        device_id: DEVICE_ID,
        device_name: 'Kid\'s Phone',
        device_type: 'android',
      });

      expect(result.device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
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

  describe('listDevicesForChild', () => {
    it('should verify ownership and return the child\'s devices', async () => {
      // verifyChildBelongsToParent
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // SELECT devices
      mockedQuery.mockResolvedValueOnce({ rows: [deviceRow] } as any);

      const result = await deviceService.listDevicesForChild(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].device_id).toBe(DEVICE_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM devices'),
        [CHILD_ID]
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