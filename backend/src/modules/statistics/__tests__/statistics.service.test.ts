// statistics.service.test.ts
// Unit tests for the pre-computed statistics service.

import * as statisticsService from '../statistics.service';
import { query } from '../../../config/database';
import * as childrenService from '../../children/children.service';

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

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
});

describe('statistics.service', () => {
  describe('getOverviewStats', () => {
    it('should aggregate screen time, location, communications and alerts', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [
            { date_recorded: '2026-08-25', total_seconds: 3000 },
            { date_recorded: '2026-08-26', total_seconds: 4500 },
          ],
        } as any) // screen time
        .mockResolvedValueOnce({ rows: [{ total_pings: 42 }] } as any) // location
        .mockResolvedValueOnce({
          rows: [{ comm_type: 'SMS_IN', count: 10, flagged: 1 }],
        } as any) // comms
        .mockResolvedValueOnce({
          rows: [{ severity: 'HIGH', count: 2 }],
        } as any); // keyword alerts

      const result = await statisticsService.getOverviewStats(
        PARENT_ID,
        CHILD_ID,
        'week'
      );

      expect(result.period.type).toBe('week');
      expect(result.screen_time.grand_total_seconds).toBe(7500);
      expect(result.screen_time.average_daily_seconds).toBe(3750);
      expect(result.location.total_pings).toBe(42);
      expect(result.communications).toHaveLength(1);
      expect(result.keyword_alerts).toHaveLength(1);
    });
  });

  describe('getSafetyScore', () => {
    it('should return a perfect 100 score with no alerts and no flagged comms', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [{ flagged_count: 0, total_count: 0 }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await statisticsService.getSafetyScore(PARENT_ID, CHILD_ID);

      expect(result.score).toBe(100);
      expect(result.breakdown.flagged_communication_ratio).toBe(0);
      expect(result.breakdown.device_rooted).toBe(false);
    });

    it('should deduct points for critical keyword alerts and rooted device', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [{ flagged_count: 5, total_count: 10 }],
        } as any) // 50% flagged → -15
        .mockResolvedValueOnce({
          rows: [
            { severity: 'CRITICAL', count: 1 }, // -20
            { severity: 'HIGH', count: 1 }, // -10
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ is_rooted: true, is_developer_options: true, is_usb_debugging: false }],
        } as any); // -25 rooted, -5 dev options

      const result = await statisticsService.getSafetyScore(PARENT_ID, CHILD_ID);

      // 100 - 15 - 20 - 10 - 25 - 5 = 25
      expect(result.score).toBe(25);
      expect(result.breakdown.critical_alerts).toBe(1);
      expect(result.breakdown.high_alerts).toBe(1);
      expect(result.breakdown.device_rooted).toBe(true);
    });
  });

  describe('getUsageSummary', () => {
    it('should return top apps, category breakdown and daily totals', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [{ app_package: 'com.z', category: 'social', total_seconds: 9000 }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ category: 'social', total_seconds: 9000 }],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { date_recorded: '2026-08-25', total_seconds: 3000 },
            { date_recorded: '2026-08-26', total_seconds: 6000 },
          ],
        } as any);

      const result = await statisticsService.getUsageSummary(
        PARENT_ID,
        CHILD_ID,
        'week'
      );

      expect(result.grand_total_seconds).toBe(9000);
      expect(result.top_apps).toHaveLength(1);
      expect(result.by_category).toHaveLength(1);
      expect(result.daily_totals).toHaveLength(2);
    });
  });

  describe('getRestrictionCompliance', () => {
    it('should return 100% compliance when no usage days exist', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{}] } as any)
        .mockResolvedValueOnce({ rows: [{ blocked_access_count: 0 }] } as any)
        .mockResolvedValueOnce({ rows: [{ active_locks: 2 }] } as any)
        .mockResolvedValueOnce({
          rows: [
            { total_rules: 4, blocked_contacts: 3, allowed_contacts: 1 },
          ],
        } as any);

      const result = await statisticsService.getRestrictionCompliance(
        PARENT_ID,
        CHILD_ID
      );

      expect(result.screen_time.compliance_rate).toBe(100);
      expect(result.app_blocking.blocked_access_count).toBe(0);
      expect(result.scheduled_locks.active_locks).toBe(2);
      expect(result.contact_rules.blocked_contacts).toBe(3);
    });
  });
});
