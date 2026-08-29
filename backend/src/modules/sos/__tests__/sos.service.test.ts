// sos.service.test.ts
// Unit tests for the emergency SOS event service.

import * as sosService from '../sos.service';
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
const EVENT_ID = '44444444-4444-4444-4444-444444444444';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('sos.service', () => {
  describe('createSosEvent', () => {
    it('should create an SOS event and write audit log', async () => {
      const sosRow = {
        id: EVENT_ID,
        device_id: DEVICE_ID,
        child_id: CHILD_ID,
        latitude: 40.7128,
        longitude: -74.006,
        battery_level: 45,
        trigger_method: 'BUTTON',
        status: 'ACTIVE',
      };
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // device lookup
        .mockResolvedValueOnce({ rows: [sosRow] } as any); // insert

      const result = await sosService.createSosEvent(PARENT_ID, DEVICE_ID, {
        latitude: 40.7128,
        longitude: -74.006,
        battery_level: 45,
        trigger_method: 'BUTTON',
      });

      expect(result.id).toBe(EVENT_ID);
      expect(result.trigger_method).toBe('BUTTON');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOS_TRIGGERED',
          details: expect.objectContaining({ trigger_method: 'BUTTON' }),
        })
      );
    });

    it('should default trigger_method to BUTTON', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: EVENT_ID, trigger_method: 'BUTTON' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // guardians lookup for push

      await sosService.createSosEvent(PARENT_ID, DEVICE_ID, {});

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO emergency_sos_events'),
        expect.arrayContaining([DEVICE_ID, CHILD_ID, null, null, null, 'BUTTON'])
      );
    });

    it('should throw NotFoundError for invalid device', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        sosService.createSosEvent(PARENT_ID, DEVICE_ID, { latitude: 40.7, longitude: -74.0 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listSosEvents', () => {
    it('should verify ownership and return events', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: EVENT_ID, status: 'ACTIVE' }],
      } as any);

      const result = await sosService.listSosEvents(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('ACTIVE');
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should filter by status when provided', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await sosService.listSosEvents(PARENT_ID, CHILD_ID, 'RESOLVED');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        [CHILD_ID, 'RESOLVED']
      );
    });
  });

  describe('acknowledgeSos', () => {
    it('should acknowledge an active event and write audit log', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: EVENT_ID, status: 'ACKNOWLEDGED' }],
      } as any);

      const result = await sosService.acknowledgeSos(PARENT_ID, CHILD_ID, EVENT_ID);

      expect(result.status).toBe('ACKNOWLEDGED');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SOS_ACKNOWLEDGED' })
      );
    });

    it('should throw NotFoundError when no active event exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        sosService.acknowledgeSos(PARENT_ID, CHILD_ID, EVENT_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('resolveSos', () => {
    it('should resolve an event and write audit log', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: EVENT_ID, status: 'RESOLVED', notes: 'Child is safe' }],
      } as any);

      const result = await sosService.resolveSos(PARENT_ID, CHILD_ID, EVENT_ID, 'Child is safe');

      expect(result.status).toBe('RESOLVED');
      expect(result.notes).toBe('Child is safe');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SOS_RESOLVED' })
      );
    });

    it('should throw NotFoundError when event is already resolved', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        sosService.resolveSos(PARENT_ID, CHILD_ID, EVENT_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
