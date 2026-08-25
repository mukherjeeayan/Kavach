// prediction.service.test.ts
// Unit tests for the behavior prediction engine service.

import * as predictionService from '../prediction.service';
import { query } from '../../../config/database';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('prediction.service', () => {
  describe('generatePredictions', () => {
    it('should return empty predictions when no data exists', async () => {
      // verifyChildBelongsToParent
      // screen time by day, recent screen time, older screen time
      // recent flagged, older flagged
      // category usage
      // deactivate old predictions
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // screen time by day
        .mockResolvedValueOnce({ rows: [{ total_seconds: 0 }] } as any) // recent screen time
        .mockResolvedValueOnce({ rows: [{ total_seconds: 0 }] } as any) // older screen time
        .mockResolvedValueOnce({ rows: [{ flagged_count: 0 }] } as any) // recent flagged
        .mockResolvedValueOnce({ rows: [{ flagged_count: 0 }] } as any) // older flagged
        .mockResolvedValueOnce({ rows: [] } as any) // category usage
        .mockResolvedValueOnce({ rows: [] } as any); // deactivate old

      const result = await predictionService.generatePredictions(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(0);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PREDICTIONS_GENERATED' })
      );
    });

    it('should generate HIGH_RISK_TIME prediction when screen time exceeds threshold', async () => {
      const predictionRow = {
        id: '77777777-7777-7777-7777-777777777777',
        child_id: CHILD_ID,
        prediction_type: 'HIGH_RISK_TIME',
        confidence: 0.85,
        risk_score: 42,
        prediction_data: { avg_daily_seconds: 5000 },
        valid_from: new Date().toISOString(),
        valid_until: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const trendRow = {
        id: '77777777-7777-7777-7777-777777777778',
        child_id: CHILD_ID,
        prediction_type: 'SCREEN_TIME_TREND',
        confidence: 0.7,
        risk_score: 25,
        prediction_data: { trend: 'INCREASING' },
        valid_from: new Date().toISOString(),
        valid_until: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [{ date_recorded: '2026-08-24', total_seconds: 5000 }] } as any) // screen time by day (avg > 3600)
        .mockResolvedValueOnce({ rows: [{ total_seconds: 15000 }] } as any) // recent screen time
        .mockResolvedValueOnce({ rows: [{ total_seconds: 10000 }] } as any) // older screen time (50% increase triggers SCREEN_TIME_TREND too)
        .mockResolvedValueOnce({ rows: [{ flagged_count: 0 }] } as any) // recent flagged
        .mockResolvedValueOnce({ rows: [{ flagged_count: 0 }] } as any) // older flagged
        .mockResolvedValueOnce({ rows: [] } as any) // category usage
        .mockResolvedValueOnce({ rows: [] } as any) // deactivate old
        .mockResolvedValueOnce({ rows: [predictionRow] } as any) // insert HIGH_RISK_TIME
        .mockResolvedValueOnce({ rows: [trendRow] } as any); // insert SCREEN_TIME_TREND

      const result = await predictionService.generatePredictions(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(2);
      expect(result[0].prediction_type).toBe('HIGH_RISK_TIME');
      expect(result[0].risk_score).toBe(42);
    });

    it('should generate SOCIAL_RISK prediction when flagged communications exceed threshold', async () => {
      const predictionRow = {
        id: '88888888-8888-8888-8888-888888888888',
        child_id: CHILD_ID,
        prediction_type: 'SOCIAL_RISK',
        confidence: 0.8,
        risk_score: 50,
        prediction_data: { recent_flagged_count: 5 },
        valid_from: new Date().toISOString(),
        valid_until: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // screen time by day
        .mockResolvedValueOnce({ rows: [{ total_seconds: 0 }] } as any) // recent screen time
        .mockResolvedValueOnce({ rows: [{ total_seconds: 0 }] } as any) // older screen time
        .mockResolvedValueOnce({ rows: [{ flagged_count: 5 }] } as any) // recent flagged (>=3 threshold)
        .mockResolvedValueOnce({ rows: [{ flagged_count: 2 }] } as any) // older flagged
        .mockResolvedValueOnce({ rows: [] } as any) // category usage
        .mockResolvedValueOnce({ rows: [] } as any) // deactivate old
        .mockResolvedValueOnce({ rows: [predictionRow] } as any); // insert prediction

      const result = await predictionService.generatePredictions(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].prediction_type).toBe('SOCIAL_RISK');
    });

    it('should generate SCREEN_TIME_TREND when usage changes significantly', async () => {
      const predictionRow = {
        id: '99999999-9999-9999-9999-999999999999',
        child_id: CHILD_ID,
        prediction_type: 'SCREEN_TIME_TREND',
        confidence: 0.7,
        risk_score: 25,
        prediction_data: { trend: 'INCREASING', change_percent: 50 },
        valid_from: new Date().toISOString(),
        valid_until: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // screen time by day (no high risk)
        .mockResolvedValueOnce({ rows: [{ total_seconds: 15000 }] } as any) // recent screen time
        .mockResolvedValueOnce({ rows: [{ total_seconds: 10000 }] } as any) // older screen time (>20% change)
        .mockResolvedValueOnce({ rows: [{ flagged_count: 0 }] } as any) // recent flagged
        .mockResolvedValueOnce({ rows: [{ flagged_count: 0 }] } as any) // older flagged
        .mockResolvedValueOnce({ rows: [] } as any) // category usage
        .mockResolvedValueOnce({ rows: [] } as any) // deactivate old
        .mockResolvedValueOnce({ rows: [predictionRow] } as any); // insert prediction

      const result = await predictionService.generatePredictions(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].prediction_type).toBe('SCREEN_TIME_TREND');
      expect(result[0].prediction_data).toMatchObject({ trend: 'INCREASING' });
    });
  });

  describe('listPredictions', () => {
    it('should verify ownership and return active predictions', async () => {
      const predictions = [
        {
          id: 'aaaa-aaaa',
          child_id: CHILD_ID,
          prediction_type: 'HIGH_RISK_TIME',
          is_active: true,
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: predictions } as any);

      const result = await predictionService.listPredictions(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM behavior_predictions'),
        [CHILD_ID]
      );
    });
  });
});
