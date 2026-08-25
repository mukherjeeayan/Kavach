// analytics.service.test.ts
// Unit tests for the analytics reporting service.

import * as analyticsService from '../analytics.service';
import { query } from '../../../config/database';
import * as childrenService from '../../children/children.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
});

describe('analytics.service', () => {
  describe('generateReport', () => {
    it('should generate a WEEKLY report with all data sections', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ date_recorded: '2026-08-18', app_package: 'com.example', app_category: 'games', total_seconds: 300 }] } as any) // screenTime
        .mockResolvedValueOnce({ rows: [{ date_recorded: '2026-08-18', total_seconds: 600 }] } as any) // dailyTotals
        .mockResolvedValueOnce({ rows: [{ category: 'games', total_seconds: 300 }] } as any) // categoryBreakdown
        .mockResolvedValueOnce({ rows: [{ total_pings: 42 }] } as any) // locationCount
        .mockResolvedValueOnce({ rows: [{ comm_type: 'SMS_IN', count: 10, flagged: 2 }] } as any) // commStats
        .mockResolvedValueOnce({ rows: [{ severity: 'HIGH', count: 1 }] } as any) // alertCount
        .mockResolvedValueOnce({ rows: [] } as any); // cache insert

      const result = await analyticsService.generateReport(PARENT_ID, CHILD_ID, 'WEEKLY');

      expect(result.period.type).toBe('WEEKLY');
      expect(result.screen_time.grand_total_seconds).toBe(600);
      expect(result.location.total_pings).toBe(42);
      expect(result.communications).toHaveLength(1);
      expect(result.keyword_alerts).toHaveLength(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO analytics_reports'),
        expect.arrayContaining([CHILD_ID, 'WEEKLY'])
      );
    });

    it('should generate a MONTHLY report with 30-day range', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total_pings: 0 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await analyticsService.generateReport(PARENT_ID, CHILD_ID, 'MONTHLY');

      expect(result.period.type).toBe('MONTHLY');
      expect(result.screen_time.grand_total_seconds).toBe(0);
    });
  });

  describe('getCachedReport', () => {
    it('should return a cached report when it exists', async () => {
      const cachedRow = {
        id: 'report-1',
        child_id: CHILD_ID,
        report_type: 'WEEKLY',
        period_start: '2026-08-11',
        period_end: '2026-08-18',
        data: { screen_time: { grand_total_seconds: 1200 } },
      };
      mockedQuery.mockResolvedValueOnce({ rows: [cachedRow] } as any);

      const result = await analyticsService.getCachedReport(PARENT_ID, CHILD_ID, 'WEEKLY');

      expect(result).toEqual(cachedRow);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should return null when no cached report exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await analyticsService.getCachedReport(PARENT_ID, CHILD_ID, 'WEEKLY');

      expect(result).toBeNull();
    });
  });

  describe('listReports', () => {
    it('should verify ownership and return list of reports', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          { id: 'r1', report_type: 'WEEKLY', period_start: '2026-08-11', period_end: '2026-08-18' },
          { id: 'r2', report_type: 'MONTHLY', period_start: '2026-07-18', period_end: '2026-08-17' },
        ],
      } as any);

      const result = await analyticsService.listReports(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(2);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });
});
