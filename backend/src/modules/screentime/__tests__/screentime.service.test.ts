// screentime.service.test.ts
// Unit tests for the screen-time aggregation service.

import * as screentimeService from '../screentime.service';
import pool, { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';
import * as appBlockRuleRepo from '../../appblocking/appBlockRule.repository';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../appblocking/appBlockRule.repository', () => ({
  getLimitRulesForDevice: jest.fn(),
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
const mockedConnect = pool.connect as jest.MockedFunction<() => Promise<any>>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;
const mockedAudit = auditService as jest.Mocked<typeof auditService>;
const mockedRuleRepo = appBlockRuleRepo as jest.Mocked<typeof appBlockRuleRepo>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';

// The batch upsert runs inside a transaction on a dedicated client;
// each call queues BEGIN → one upsert per entry → COMMIT.
const mockTxClient = (entryCount: number) => {
  const client = { query: jest.fn(), release: jest.fn() };
  client.query.mockResolvedValue({ rows: [] } as any);
  mockedConnect.mockResolvedValue(client as any);
  return { client, upsertCalls: entryCount };
};

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) also clears queued mockResolvedValueOnce
  // values, so leftover query queues can never leak between tests.
  jest.resetAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
  mockedRuleRepo.getLimitRulesForDevice.mockResolvedValue([]);
});

describe('screentime.service', () => {
  describe('recordScreenTime', () => {
    it('should reject devices that do not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
          { app_package: 'com.example.app', seconds: 60 },
        ])
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });

    it('should upsert every entry and write one audit log', async () => {
      const { client } = mockTxClient(2);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: null }] } as any); // limit fetch

      await screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
        { app_package: 'com.example.app', seconds: 60 },
        { app_package: 'com.example.game', app_category: 'games', seconds: 120, date: '2026-08-18' },
      ]);

      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO screen_time_logs'),
        [DEVICE_ID, 'com.example.app', null, 60, expect.any(String)]
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO screen_time_logs'),
        [DEVICE_ID, 'com.example.game', 'games', 120, '2026-08-18']
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPLOAD_SCREEN_TIME',
          targetChildId: CHILD_ID,
          details: { device_id: DEVICE_ID, entries: 2 },
        })
      );
    });

    it('should raise a SCREEN_TIME_LIMIT_REACHED alert when the daily total crosses the limit', async () => {
      mockTxClient(1);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: 60 }] } as any) // limit fetch
        .mockResolvedValueOnce({ rows: [{ total_seconds: 5000 }] } as any) // today's total
        .mockResolvedValueOnce({ rows: [] } as any); // dedupe check — no alert yet today

      await screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
        { app_package: 'com.example.app', seconds: 3600 },
      ]);

      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SCREEN_TIME_LIMIT_REACHED',
          targetChildId: CHILD_ID,
          details: expect.objectContaining({
            limit_minutes: 60,
            total_minutes: 83, // 5000s
          }),
        })
      );
    });

    it('should not duplicate the limit alert for the same day', async () => {
      mockTxClient(1);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: 30 }] } as any) // limit fetch
        .mockResolvedValueOnce({ rows: [{ total_seconds: 5000 }] } as any) // today's total
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] } as any); // dedupe check — alert already exists

      await screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
        { app_package: 'com.example.app', seconds: 3600 },
      ]);

      const limitAlertCalls = mockedAudit.writeAuditLog.mock.calls.filter(
        ([entry]) => entry.action === 'SCREEN_TIME_LIMIT_REACHED'
      );
      expect(limitAlertCalls).toHaveLength(0);
    });

    it('should not raise alerts when no limit is configured', async () => {
      mockTxClient(1);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: null }] } as any); // limit fetch

      await screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
        { app_package: 'com.example.app', seconds: 999999 },
      ]);

      const limitAlertCalls = mockedAudit.writeAuditLog.mock.calls.filter(
        ([entry]) => entry.action === 'SCREEN_TIME_LIMIT_REACHED'
      );
      expect(limitAlertCalls).toHaveLength(0);
    });

    it('should emit one PER_APP_LIMIT_REACHED alert when a per-app cap is exceeded', async () => {
      mockedRuleRepo.getLimitRulesForDevice.mockResolvedValue([
        { id: 'rule-1', package_name: 'com.example.game', daily_limit_minutes: 30 },
      ] as any);
      mockTxClient(1);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: null }] } as any) // daily limit fetch
        .mockResolvedValueOnce({ rows: [{ app_package: 'com.example.game', total_seconds: 2400 }] } as any) // per-app totals
        .mockResolvedValueOnce({ rows: [] } as any); // dedupe check — no alert yet today

      await screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
        { app_package: 'com.example.game', seconds: 60 },
      ]);

      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PER_APP_LIMIT_REACHED',
          targetChildId: CHILD_ID,
          details: expect.objectContaining({
            rule_id: 'rule-1',
            package_name: 'com.example.game',
            limit_minutes: 30,
            used_minutes: 40, // 2400s
          }),
        })
      );
    });

    it('should not duplicate the per-app alert for the same day', async () => {
      mockedRuleRepo.getLimitRulesForDevice.mockResolvedValue([
        { id: 'rule-1', package_name: 'com.example.game', daily_limit_minutes: 30 },
      ] as any);
      mockTxClient(1);
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any) // ownership
        .mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: null }] } as any) // daily limit fetch
        .mockResolvedValueOnce({ rows: [{ app_package: 'com.example.game', total_seconds: 2400 }] } as any) // per-app totals
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] } as any); // dedupe check — alert already exists

      await screentimeService.recordScreenTime(PARENT_ID, DEVICE_ID, [
        { app_package: 'com.example.game', seconds: 60 },
      ]);

      const perAppAlertCalls = mockedAudit.writeAuditLog.mock.calls.filter(
        ([entry]) => entry.action === 'PER_APP_LIMIT_REACHED'
      );
      expect(perAppAlertCalls).toHaveLength(0);
    });
  });

  describe('getDailyScreenTime', () => {
    it('should verify ownership and return per-app usage', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { device_id: DEVICE_ID, app_package: 'com.example.app', total_seconds: 300 },
        ],
      } as any);

      const result = await screentimeService.getDailyScreenTime(PARENT_ID, CHILD_ID, '2026-08-18');

      expect(result).toHaveLength(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date_recorded = $1'),
        ['2026-08-18', CHILD_ID]
      );
    });
  });

  describe('getScreenTimeSummary', () => {
    it('should aggregate daily and per-app totals', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [
            { date_recorded: '2026-08-17', total_seconds: '600' },
            { date_recorded: '2026-08-18', total_seconds: '1200' },
          ],
        } as any) // daily
        .mockResolvedValueOnce({
          rows: [{ app_package: 'com.example.app', app_category: 'unknown', total_seconds: '1800' }],
        } as any); // by app

      const result = await screentimeService.getScreenTimeSummary(PARENT_ID, CHILD_ID, 'week');

      expect(result.range).toBe('week');
      expect(result.total_seconds).toBe(1800);
      expect(result.daily).toHaveLength(2);
      expect(result.by_app).toHaveLength(1);
      // week = 7 days
      expect(mockedQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('CURRENT_DATE - $1::int'),
        [7, CHILD_ID]
      );
    });
  });
});