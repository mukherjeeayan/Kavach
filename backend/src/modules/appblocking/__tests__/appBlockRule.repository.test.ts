// appBlockRule.repository.test.ts
// Unit tests for the app block rule repository layer.

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { query } from '../../../config/database';
import * as repo from '../appBlockRule.repository';

const mockedQuery = query as jest.MockedFunction<typeof query>;

beforeEach(() => {
  jest.clearAllMocks();
});

const CHILD_ID = 'child-1';
const DEVICE_ID = 'device-1';
const RULE_ID = 'rule-1';

describe('appBlockRule.repository', () => {
  describe('getBlockedAppsByChildId', () => {
    test('returns rules for a child', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)   // count query
        .mockResolvedValueOnce({                                    // data query
          rows: [{ id: RULE_ID, device_id: DEVICE_ID, package_name: 'com.test' }],
        } as any);

      const result = await repo.getBlockedAppsByChildId(CHILD_ID);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].package_name).toBe('com.test');
    });

    test('returns empty array when no rules', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await repo.getBlockedAppsByChildId(CHILD_ID);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getRuleByIdAndChildId', () => {
    test('returns rule when found', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, child_id: CHILD_ID, package_name: 'com.test' }],
      } as any);

      const result = await repo.getRuleByIdAndChildId(RULE_ID, CHILD_ID);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(RULE_ID);
    });

    test('returns null when not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await repo.getRuleByIdAndChildId(RULE_ID, CHILD_ID);
      expect(result).toBeNull();
    });
  });

  describe('createBlockRule', () => {
    test('inserts and returns the new rule', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, device_id: DEVICE_ID, package_name: 'com.test', is_blocked: true }],
      } as any);

      const result = await repo.createBlockRule({
        device_id: DEVICE_ID,
        child_id: CHILD_ID,
        package_name: 'com.test',
        app_name: 'Test App',
        block_reason: 'distraction',
      });
      expect(result).not.toBeNull();
      expect(result.package_name).toBe('com.test');
      expect(result.child_id).toBe(CHILD_ID);
    });
  });

  describe('deleteBlockRule', () => {
    test('returns true when rule is deleted', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      const result = await repo.deleteBlockRule(RULE_ID);
      expect(result).toBe(true);
    });

    test('returns false when rule not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      const result = await repo.deleteBlockRule(RULE_ID);
      expect(result).toBe(false);
    });
  });

  describe('setDailyLimit', () => {
    test('updates and returns the rule with new limit', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, daily_limit_minutes: 60 }],
      } as any);

      const result = await repo.setDailyLimit(RULE_ID, 60);
      expect(result).not.toBeNull();
      expect(result!.daily_limit_minutes).toBe(60);
    });

    test('clears limit when null', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, daily_limit_minutes: null }],
      } as any);

      const result = await repo.setDailyLimit(RULE_ID, null);
      expect(result).not.toBeNull();
      expect(result!.daily_limit_minutes).toBeNull();
    });

    test('returns null when rule not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await repo.setDailyLimit('nonexistent', 60);
      expect(result).toBeNull();
    });
  });

  describe('getLimitRulesForDevice', () => {
    test('returns rules that have a daily limit set', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, package_name: 'com.test', daily_limit_minutes: 30 }],
      } as any);

      const result = await repo.getLimitRulesForDevice(DEVICE_ID);
      expect(result).toHaveLength(1);
      expect(result[0].daily_limit_minutes).toBe(30);
    });

    test('returns empty when no limits set', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await repo.getLimitRulesForDevice(DEVICE_ID);
      expect(result).toHaveLength(0);
    });
  });

  describe('verifyDeviceBelongsToChild', () => {
    test('returns true when device belongs to child', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any);

      const result = await repo.verifyDeviceBelongsToChild(DEVICE_ID, CHILD_ID);
      expect(result).toBe(true);
    });

    test('returns false when device does not belong to child', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await repo.verifyDeviceBelongsToChild(DEVICE_ID, CHILD_ID);
      expect(result).toBe(false);
    });
  });

  describe('updateBlockStatus', () => {
    test('updates and returns the rule', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, is_blocked: false }],
      } as any);

      const result = await repo.updateBlockStatus(RULE_ID, false);
      expect(result).not.toBeNull();
      expect(result!.is_blocked).toBe(false);
    });

    test('returns null when rule not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await repo.updateBlockStatus(RULE_ID, false);
      expect(result).toBeNull();
    });
  });

  describe('setUnblockRequest', () => {
    test('updates and returns the rule', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: RULE_ID, unblock_requested: true, unblock_reason: 'homework' }],
      } as any);

      const result = await repo.setUnblockRequest(RULE_ID, 'homework');
      expect(result).not.toBeNull();
      expect(result!.unblock_requested).toBe(true);
    });
  });
});
