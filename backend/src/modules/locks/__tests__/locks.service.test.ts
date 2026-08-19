// locks.service.test.ts
// Unit tests for the scheduled lock windows service.

import * as locksService from '../locks.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';

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
const LOCK_ID = '44444444-4444-4444-4444-444444444444';

const lockRow = {
  id: LOCK_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  day_of_week: null,
  start_time: '20:00',
  end_time: '07:00',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedChildren.ensureDeviceBelongsToChild.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('locks.service', () => {
  describe('listLocks', () => {
    it('should verify ownership and return lock windows with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any) // COUNT
        .mockResolvedValueOnce({ rows: [lockRow] } as any); // SELECT page

      const result = await locksService.listLocks(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM scheduled_locks'),
        [CHILD_ID, 20, 0]
      );
    });
  });

  describe('createLock', () => {
    it('should verify ownership and device, insert and audit', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [lockRow] } as any);

      const result = await locksService.createLock(PARENT_ID, CHILD_ID, {
        device_id: DEVICE_ID,
        start_time: '20:00',
        end_time: '07:00',
      });

      expect(result.id).toBe(LOCK_ID);
      expect(mockedChildren.ensureDeviceBelongsToChild).toHaveBeenCalledWith(CHILD_ID, DEVICE_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scheduled_locks'),
        [CHILD_ID, DEVICE_ID, null, '20:00', '07:00', true]
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_LOCK', targetChildId: CHILD_ID })
      );
    });
  });

  describe('updateLock', () => {
    it('should update and audit an existing lock', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ ...lockRow, is_active: false }] } as any);

      const result = await locksService.updateLock(PARENT_ID, CHILD_ID, LOCK_ID, {
        is_active: false,
      });

      expect(result.is_active).toBe(false);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_locks'),
        expect.arrayContaining([LOCK_ID, CHILD_ID])
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_LOCK' })
      );
    });

    it('should throw NotFoundError when the lock does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        locksService.updateLock(PARENT_ID, CHILD_ID, LOCK_ID, { is_active: false })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('deleteLock', () => {
    it('should delete and audit an existing lock', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await expect(
        locksService.deleteLock(PARENT_ID, CHILD_ID, LOCK_ID)
      ).resolves.toBeUndefined();
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_LOCK' })
      );
    });

    it('should throw NotFoundError when the lock does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        locksService.deleteLock(PARENT_ID, CHILD_ID, LOCK_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });
});