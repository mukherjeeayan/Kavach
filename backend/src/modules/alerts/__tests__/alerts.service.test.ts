// alerts.service.test.ts
// Unit tests for the unified alerts service.

import * as alertsService from '../alerts.service';
import { query } from '../../../config/database';
import * as childrenService from '../../children/children.service';
import * as pushService from '../../shared/pushNotificationService';
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

jest.mock('../../shared/pushNotificationService', () => ({
  sendPushToAllParents: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;
const mockedPush = pushService as jest.Mocked<typeof pushService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const ALERT_ID = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  jest.clearAllMocks();
  mockedQuery.mockReset();
  mockedQuery.mockResolvedValue({ rows: [] } as any);
  mockedChildren.verifyChildBelongsToParent.mockReset();
  mockedPush.sendPushToAllParents.mockReset();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedPush.sendPushToAllParents.mockResolvedValue(undefined);
});

describe('alerts.service', () => {
  describe('getAlerts', () => {
    it('should verify ownership and return paginated alerts from multiple sources', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 3 }] } as any) // COUNT
        .mockResolvedValueOnce({
          rows: [
            { id: ALERT_ID, alert_type: 'KEYWORD_ALERT', severity: 'HIGH' },
            { id: 'sos-1', alert_type: 'SOS_EVENT', severity: 'CRITICAL' },
            { id: 'audit-1', alert_type: 'TAMPER_ALERT', severity: 'HIGH' },
          ],
        } as any);

      const result = await alertsService.getAlerts(PARENT_ID, CHILD_ID, {
        page: 1,
        limit: 20,
        alert_type: undefined,
        unacknowledged_only: false,
      });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(
        CHILD_ID,
        PARENT_ID
      );
    });
  });

  describe('markAsRead', () => {
    it('should update a KEYWORD_ALERT and re-fetch it', async () => {
      const initial = {
        id: ALERT_ID,
        alert_type: 'KEYWORD_ALERT',
        is_acknowledged: false,
      };
      const acknowledged = { ...initial, is_acknowledged: true };

      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // audit_logs
        .mockResolvedValueOnce({ rows: [initial] } as any) // keyword_alerts hit
        .mockResolvedValueOnce({ rows: [] } as any) // UPDATE keyword_alerts
        .mockResolvedValueOnce({ rows: [] } as any) // re-fetch audit_logs
        .mockResolvedValueOnce({ rows: [acknowledged] } as any); // re-fetch keyword_alerts

      const result = await alertsService.markAsRead(PARENT_ID, CHILD_ID, ALERT_ID);

      expect(result.is_acknowledged).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE keyword_alerts SET is_reviewed = true'),
        [ALERT_ID]
      );
      expect(mockedPush.sendPushToAllParents).toHaveBeenCalled();
    });

    it('should be a no-op when the alert is already acknowledged', async () => {
      const alreadyRead = {
        id: ALERT_ID,
        alert_type: 'KEYWORD_ALERT',
        is_acknowledged: true,
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // audit_logs
        .mockResolvedValueOnce({ rows: [alreadyRead] } as any); // keyword_alerts hit

      const result = await alertsService.markAsRead(PARENT_ID, CHILD_ID, ALERT_ID);

      expect(result).toEqual(alreadyRead);
      // Should not have issued any UPDATE
      const updateCalls = mockedQuery.mock.calls.filter((c: any) =>
        String(c[0]).startsWith('UPDATE')
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe('deleteAlert', () => {
    it('should soft-delete (acknowledge) the alert and return deleted=true', async () => {
      const acknowledged = {
        id: ALERT_ID,
        alert_type: 'SELF_HARM_ALERT',
        is_acknowledged: true,
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // audit_logs
        .mockResolvedValueOnce({ rows: [] } as any) // keyword_alerts
        .mockResolvedValueOnce({ rows: [acknowledged] } as any) // self_harm_alerts hit
        .mockResolvedValueOnce({ rows: [] } as any) // UPDATE self_harm_alerts (inside markAsRead)
        .mockResolvedValueOnce({ rows: [] } as any) // re-fetch audit_logs
        .mockResolvedValueOnce({ rows: [] } as any) // re-fetch keyword_alerts
        .mockResolvedValueOnce({ rows: [acknowledged] } as any); // re-fetch self_harm_alerts

      const result = await alertsService.deleteAlert(PARENT_ID, CHILD_ID, ALERT_ID);

      expect(result.deleted).toBe(true);
    });
  });

  describe('getAlertById', () => {
    it('should throw NotFoundError when the alert is not found in any source', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // audit_logs
        .mockResolvedValueOnce({ rows: [] } as any) // keyword_alerts
        .mockResolvedValueOnce({ rows: [] } as any) // self_harm_alerts
        .mockResolvedValueOnce({ rows: [] } as any); // emergency_sos_events

      await expect(
        alertsService.getAlertById(PARENT_ID, CHILD_ID, 'nonexistent')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
