// mood.service.test.ts
// Unit tests for the mood tracking service.

import * as moodService from '../mood.service';
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
const MOOD_ID = '44444444-4444-4444-4444-444444444444';

const moodRow = {
  id: MOOD_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  mood_score: 7,
  note: 'Feeling okay today',
  activities: ['reading', 'walking'],
  recorded_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('mood.service', () => {
  describe('createMoodLog', () => {
    it('should create a mood log when device belongs to parent', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [moodRow] } as any);

      const result = await moodService.createMoodLog(PARENT_ID, DEVICE_ID, {
        mood_score: 7,
        note: 'Feeling okay today',
        activities: ['reading', 'walking'],
      });

      expect(result.id).toBe(MOOD_ID);
      expect(result.mood_score).toBe(7);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mood_logs'),
        [CHILD_ID, DEVICE_ID, 7, 'Feeling okay today', ['reading', 'walking']]
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MOOD_LOG_CREATED', targetChildId: CHILD_ID })
      );
    });

    it('should throw NotFoundError when device does not belong to parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        moodService.createMoodLog(PARENT_ID, DEVICE_ID, { mood_score: 5 })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('listMoodLogs', () => {
    it('should verify ownership and return mood logs with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [moodRow] } as any);

      const result = await moodService.listMoodLogs(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('getMoodSummary', () => {
    it('should verify ownership and return weekly mood averages', async () => {
      const summaryRow = {
        week_start: '2026-08-18',
        avg_mood: 6.5,
        entry_count: 5,
      };
      mockedQuery.mockResolvedValueOnce({ rows: [summaryRow] } as any);

      const result = await moodService.getMoodSummary(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].avg_mood).toBe(6.5);
      expect(result[0].entry_count).toBe(5);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });
});
