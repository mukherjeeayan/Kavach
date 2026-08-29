// reports.service.test.ts
// Unit tests for the reports aggregation service.

import * as reportsService from '../reports.service';
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

describe('reports.service', () => {
  describe('getSafetyReport', () => {
    it('should aggregate alerts, app blocking, and screen time violations', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ severity: 'HIGH', count: 2 }] } as any) // keyword
        .mockResolvedValueOnce({ rows: [{ risk_level: 'MEDIUM', count: 1 }] } as any) // self-harm
        .mockResolvedValueOnce({ rows: [{ status: 'RESOLVED', count: 1 }] } as any) // sos
        .mockResolvedValueOnce({ rows: [{ has_threats: true, count: 3 }] } as any) // security
        .mockResolvedValueOnce({ rows: [{ total_blocked: 7 }] } as any) // blocked apps
        .mockResolvedValueOnce({ rows: [{ violations: 4 }] } as any); // screen time

      const result = await reportsService.getSafetyReport(PARENT_ID, CHILD_ID, 'week');

      expect(result.period.type).toBe('week');
      expect(result.keyword_alerts).toHaveLength(1);
      expect(result.self_harm_alerts).toHaveLength(1);
      expect(result.sos_events).toHaveLength(1);
      expect(result.security_alerts).toHaveLength(1);
      expect(result.app_blocking).toEqual({ total_blocked: 7 });
      expect(result.screen_time_violations).toEqual({ violations: 4 });
    });
  });

  describe('getLocationReport', () => {
    it('should aggregate pings, daily activity, geofence events and active geofences', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total_pings: 100 }] } as any)
        .mockResolvedValueOnce({
          rows: [{ date: '2026-08-25', pings: 50 }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ geofence_id: 'g1', event_type: 'ENTER', count: 3 }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ count: 4 }] } as any);

      const result = await reportsService.getLocationReport(PARENT_ID, CHILD_ID, 'month');

      expect(result.total_pings).toBe(100);
      expect(result.daily_activity).toHaveLength(1);
      expect(result.geofence_events).toHaveLength(1);
      expect(result.active_geofences).toBe(4);
    });
  });

  describe('getUsageReport', () => {
    it('should return daily totals, top apps, and category breakdown', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [
            { date_recorded: '2026-08-25', total_seconds: 3000 },
            { date_recorded: '2026-08-26', total_seconds: 4500 },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { app_package: 'com.example', app_category: 'social', total_seconds: 5000 },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ category: 'social', total_seconds: 5000 }],
        } as any);

      const result = await reportsService.getUsageReport(PARENT_ID, CHILD_ID, 'week');

      expect(result.screen_time.grand_total_seconds).toBe(7500);
      expect(result.screen_time.daily_totals).toHaveLength(2);
      expect(result.screen_time.top_apps).toHaveLength(1);
      expect(result.screen_time.by_category).toHaveLength(1);
    });
  });

  describe('getCommunicationReport', () => {
    it('should return communication stats, daily volume, top contacts and flagged count', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [
            {
              comm_type: 'SMS_IN',
              count: 20,
              flagged: 2,
              total_duration_seconds: 0,
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ date: '2026-08-25', comm_type: 'SMS_IN', count: 20 }],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { contact_number: '+1', contact_name: 'Alice', interactions: 8 },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [{ flagged_count: 2 }] } as any);

      const result = await reportsService.getCommunicationReport(
        PARENT_ID,
        CHILD_ID,
        'week'
      );

      expect(result.communication_stats).toHaveLength(1);
      expect(result.daily_volume).toHaveLength(1);
      expect(result.top_contacts).toHaveLength(1);
      expect(result.flagged_count).toBe(2);
    });
  });
});
