// geofence.service.test.ts
// Unit tests for the geofence CRUD and detection service.

import * as geofenceService from '../geofence.service';
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
  ensureDeviceBelongsToChild: jest.fn(),
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
const GEOFENCE_ID = '44444444-4444-4444-4444-444444444444';

const geofenceRow = {
  id: GEOFENCE_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  name: 'Home',
  latitude: 40.7128,
  longitude: -74.006,
  radius_meters: 200,
  zone_type: 'HOME',
  alert_on_entry: false,
  alert_on_exit: true,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedChildren.ensureDeviceBelongsToChild.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
  mockedPagination.toOffset.mockReturnValue(0);
  mockedPagination.buildPaginationMeta.mockReturnValue({ page: 1, limit: 20, total: 1, total_pages: 1 });
});

describe('geofence.service', () => {
  describe('listGeofences', () => {
    it('should verify ownership and return paginated geofences', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [geofenceRow] } as any) // items
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any); // count

      const result = await geofenceService.listGeofences(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('createGeofence', () => {
    it('should create a geofence and write audit log', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [geofenceRow] } as any);

      const result = await geofenceService.createGeofence(PARENT_ID, CHILD_ID, {
        name: 'Home',
        latitude: 40.7128,
        longitude: -74.006,
        radius_meters: 200,
        zone_type: 'HOME',
        alert_on_entry: false,
        alert_on_exit: true,
        device_id: DEVICE_ID,
        is_active: true,
      });

      expect(result.name).toBe('Home');
      expect(result.zone_type).toBe('HOME');
      expect(mockedChildren.ensureDeviceBelongsToChild).toHaveBeenCalledWith(CHILD_ID, DEVICE_ID);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_GEOFENCE' })
      );
    });

    it('should skip device verification when no device_id provided', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [geofenceRow] } as any);

      await geofenceService.createGeofence(PARENT_ID, CHILD_ID, {
        name: 'Park',
        latitude: 40.75,
        longitude: -73.98,
        radius_meters: 100,
        zone_type: 'CUSTOM',
        alert_on_entry: false,
        alert_on_exit: true,
        is_active: true,
      });

      expect(mockedChildren.ensureDeviceBelongsToChild).not.toHaveBeenCalled();
    });
  });

  describe('updateGeofence', () => {
    it('should update and audit an existing geofence', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: GEOFENCE_ID }] } as any) // existence check
        .mockResolvedValueOnce({ rows: [{ ...geofenceRow, name: 'Updated Home' }] } as any); // update

      const result = await geofenceService.updateGeofence(PARENT_ID, CHILD_ID, GEOFENCE_ID, {
        name: 'Updated Home',
      });

      expect(result.name).toBe('Updated Home');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_GEOFENCE' })
      );
    });

    it('should throw NotFoundError when geofence does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        geofenceService.updateGeofence(PARENT_ID, CHILD_ID, GEOFENCE_ID, { name: 'New' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteGeofence', () => {
    it('should delete and audit an existing geofence', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: GEOFENCE_ID }] } as any);

      await expect(
        geofenceService.deleteGeofence(PARENT_ID, CHILD_ID, GEOFENCE_ID)
      ).resolves.toBeUndefined();
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_GEOFENCE' })
      );
    });

    it('should throw NotFoundError when geofence does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        geofenceService.deleteGeofence(PARENT_ID, CHILD_ID, GEOFENCE_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getActiveGeofencesForChild', () => {
    it('should return active geofences for device sync', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ name: 'Home', latitude: 40.7128, longitude: -74.006, radius_meters: 200 }],
      } as any);

      const result = await geofenceService.getActiveGeofencesForChild(CHILD_ID);

      expect(result).toHaveLength(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = TRUE'),
        [CHILD_ID]
      );
    });
  });
});
