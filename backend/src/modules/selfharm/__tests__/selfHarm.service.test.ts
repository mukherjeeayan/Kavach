// selfHarm.service.test.ts
// Unit tests for the self-harm alert management service.

import * as selfHarmService from '../selfHarm.service';
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
const ALERT_ID = '44444444-4444-4444-4444-444444444444';

const alertRow = {
  id: ALERT_ID,
  child_id: CHILD_ID,
  device_id: '33333333-3333-3333-3333-333333333333',
  source_type: 'TEXT_ANALYSIS',
  detected_keywords: ['hurt', 'pain'],
  content_snippet: 'I want to hurt myself',
  risk_level: 'HIGH',
  is_acknowledged: false,
  acknowledged_at: null,
  acknowledged_by: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('selfHarm.service', () => {
  describe('listAlerts', () => {
    it('should verify ownership and return alerts with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [alertRow] } as any);

      const result = await selfHarmService.listAlerts(PARENT_ID, CHILD_ID, false, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should filter unacknowledged alerts when flag is set', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [alertRow] } as any);

      const result = await selfHarmService.listAlerts(PARENT_ID, CHILD_ID, true, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_acknowledged = FALSE'),
        expect.arrayContaining([CHILD_ID])
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert and audit', async () => {
      const acknowledgedAlert = { ...alertRow, is_acknowledged: true, acknowledged_by: PARENT_ID };
      mockedQuery.mockResolvedValueOnce({ rows: [acknowledgedAlert] } as any);

      const result = await selfHarmService.acknowledgeAlert(PARENT_ID, CHILD_ID, ALERT_ID);

      expect(result.is_acknowledged).toBe(true);
      expect(result.acknowledged_by).toBe(PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE self_harm_alerts'),
        [PARENT_ID, ALERT_ID, CHILD_ID]
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SELF_HARM_ALERT_ACKNOWLEDGED', targetChildId: CHILD_ID })
      );
    });

    it('should throw NotFoundError when alert is already acknowledged or not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        selfHarmService.acknowledgeAlert(PARENT_ID, CHILD_ID, ALERT_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getUnacknowledgedCount', () => {
    it('should return the count of unacknowledged alerts for a child', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);

      const result = await selfHarmService.getUnacknowledgedCount(CHILD_ID);

      expect(result).toBe(3);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [CHILD_ID]
      );
    });
  });
});
