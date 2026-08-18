// appBlocking.service.test.ts
// Unit test stubs for the App Blocking service layer.
// Each test isolates the service from the database by mocking the
// repository and the raw query helper.

import * as appBlockingService from '../appBlocking.service';
import * as appBlockRuleRepo from '../../repositories/appBlockRule.repository';
import { query } from '../../config/database';

// ── Mocks ─────────────────────────────────────────────────────────

jest.mock('../../repositories/appBlockRule.repository');
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedRepo = appBlockRuleRepo as jest.Mocked<typeof appBlockRuleRepo>;
const mockedQuery = query as jest.MockedFunction<typeof query>;

// ── Helpers ───────────────────────────────────────────────────────

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const RULE_ID = '44444444-4444-4444-4444-444444444444';

const mockRule = {
  id: RULE_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  package_name: 'com.example.app',
  app_name: 'Example App',
  is_blocked: true,
  block_reason: 'Inappropriate content',
  unblock_requested: false,
  unblock_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Reset all mocks between tests so state never leaks
beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────

describe('appBlocking.service', () => {

  // ── Ownership verification ──────────────────────────────────

  describe('verifyChildBelongsToParent', () => {
    it('should resolve silently when child belongs to parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      await expect(
        appBlockingService.verifyChildBelongsToParent(CHILD_ID, PARENT_ID)
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when child does not belong to parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      await expect(
        appBlockingService.verifyChildBelongsToParent(CHILD_ID, PARENT_ID)
      ).rejects.toThrow(appBlockingService.ForbiddenError);
    });
  });

  // ── blockApp ────────────────────────────────────────────────

  describe('blockApp', () => {
    it('should create a block rule and write an audit log', async () => {
      // Ownership check passes
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      // createBlockRule returns the rule
      mockedRepo.createBlockRule.mockResolvedValueOnce(mockRule);
      // Audit log insert succeeds
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await appBlockingService.blockApp(
        PARENT_ID, CHILD_ID, DEVICE_ID, 'com.example.app', 'Example App', 'Inappropriate content'
      );

      expect(result).toEqual(mockRule);
      expect(mockedRepo.createBlockRule).toHaveBeenCalledTimes(1);
      // Verify audit log was written (the second query call)
      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenError if child does not belong to parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        appBlockingService.blockApp(
          PARENT_ID, CHILD_ID, DEVICE_ID, 'com.example.app'
        )
      ).rejects.toThrow(appBlockingService.ForbiddenError);
    });
  });

  // ── unblockApp ──────────────────────────────────────────────

  describe('unblockApp', () => {
    it('should delete the rule and write an audit log', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(mockRule);
      mockedRepo.deleteBlockRule.mockResolvedValueOnce(true);
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        appBlockingService.unblockApp(PARENT_ID, CHILD_ID, RULE_ID)
      ).resolves.toBeUndefined();

      expect(mockedRepo.deleteBlockRule).toHaveBeenCalledWith(RULE_ID);
    });

    it('should throw NotFoundError if rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(null);

      await expect(
        appBlockingService.unblockApp(PARENT_ID, CHILD_ID, RULE_ID)
      ).rejects.toThrow(appBlockingService.NotFoundError);
    });
  });

  // ── requestUnblock ──────────────────────────────────────────

  describe('requestUnblock', () => {
    it('should set unblock_requested and return the updated rule', async () => {
      const blockedRule = { ...mockRule, is_blocked: true, unblock_requested: false };
      // Ownership check passes
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(blockedRule);
      mockedRepo.setUnblockRequest.mockResolvedValueOnce({
        ...blockedRule,
        unblock_requested: true,
        unblock_reason: 'Need it for homework',
      });

      const result = await appBlockingService.requestUnblock(
        PARENT_ID, CHILD_ID, RULE_ID, 'Need it for homework'
      );

      expect(result.unblock_requested).toBe(true);
      expect(result.unblock_reason).toBe('Need it for homework');
    });

    it('should throw NotFoundError if rule not found for this child', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(null);

      await expect(
        appBlockingService.requestUnblock(PARENT_ID, CHILD_ID, RULE_ID, 'reason')
      ).rejects.toThrow(appBlockingService.NotFoundError);
    });

    it('should throw ConflictError if app is not currently blocked', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce({
        ...mockRule,
        is_blocked: false,
      });

      await expect(
        appBlockingService.requestUnblock(PARENT_ID, CHILD_ID, RULE_ID, 'reason')
      ).rejects.toThrow(appBlockingService.ConflictError);
    });

    it('should throw ConflictError if an unblock request is already pending', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce({
        ...mockRule,
        is_blocked: true,
        unblock_requested: true,
      });

      await expect(
        appBlockingService.requestUnblock(PARENT_ID, CHILD_ID, RULE_ID, 'reason')
      ).rejects.toThrow(appBlockingService.ConflictError);
    });
  });

  // ── approveUnblock ──────────────────────────────────────────

  describe('approveUnblock', () => {
    it('should unblock the rule and write an audit log', async () => {
      const pendingRule = { ...mockRule, unblock_requested: true, unblock_reason: 'homework' };
      const unblockedRule = { ...pendingRule, is_blocked: false, unblock_requested: false };
      // Ownership check passes
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(pendingRule);
      mockedRepo.updateBlockStatus.mockResolvedValueOnce(unblockedRule);
      // Audit log insert succeeds
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await appBlockingService.approveUnblock(PARENT_ID, CHILD_ID, RULE_ID);

      expect(result.is_blocked).toBe(false);
      expect(result.unblock_requested).toBe(false);
      expect(mockedRepo.updateBlockStatus).toHaveBeenCalledWith(RULE_ID, false);
      // Ownership check + audit log write
      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundError if rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(null);

      await expect(
        appBlockingService.approveUnblock(PARENT_ID, CHILD_ID, RULE_ID)
      ).rejects.toThrow(appBlockingService.NotFoundError);
    });

    it('should throw ConflictError if no unblock request is pending', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce({
        ...mockRule,
        unblock_requested: false,
      });

      await expect(
        appBlockingService.approveUnblock(PARENT_ID, CHILD_ID, RULE_ID)
      ).rejects.toThrow(appBlockingService.ConflictError);
      expect(mockedRepo.updateBlockStatus).not.toHaveBeenCalled();
    });
  });

  // ── rejectUnblock ───────────────────────────────────────────

  describe('rejectUnblock', () => {
    it('should keep the rule blocked and write an audit log', async () => {
      const pendingRule = { ...mockRule, unblock_requested: true, unblock_reason: 'homework' };
      // Ownership check passes
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(pendingRule);
      mockedRepo.updateBlockStatus.mockResolvedValueOnce({
        ...pendingRule,
        unblock_requested: false,
      });
      // Audit log insert succeeds
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await appBlockingService.rejectUnblock(PARENT_ID, CHILD_ID, RULE_ID);

      expect(result.is_blocked).toBe(true);
      expect(result.unblock_requested).toBe(false);
      expect(mockedRepo.updateBlockStatus).toHaveBeenCalledWith(RULE_ID, true);
      // Ownership check + audit log write
      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundError if rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce(null);

      await expect(
        appBlockingService.rejectUnblock(PARENT_ID, CHILD_ID, RULE_ID)
      ).rejects.toThrow(appBlockingService.NotFoundError);
    });

    it('should throw ConflictError if no unblock request is pending', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getRuleByIdAndChildId.mockResolvedValueOnce({
        ...mockRule,
        unblock_requested: false,
      });

      await expect(
        appBlockingService.rejectUnblock(PARENT_ID, CHILD_ID, RULE_ID)
      ).rejects.toThrow(appBlockingService.ConflictError);
      expect(mockedRepo.updateBlockStatus).not.toHaveBeenCalled();
    });
  });

  // ── getBlockedApps ──────────────────────────────────────────

  describe('getBlockedApps', () => {
    it('should return blocked apps after verifying ownership', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getBlockedAppsByChildId.mockResolvedValueOnce([mockRule]);

      const result = await appBlockingService.getBlockedApps(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].package_name).toBe('com.example.app');
    });
  });

  // ── getUnblockRequests ──────────────────────────────────────

  describe('getUnblockRequests', () => {
    it('should return pending unblock requests after verifying ownership', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
      mockedRepo.getUnblockRequests.mockResolvedValueOnce([
        { ...mockRule, unblock_requested: true, unblock_reason: 'homework' },
      ]);

      const result = await appBlockingService.getUnblockRequests(PARENT_ID, CHILD_ID);

      expect(result).toHaveLength(1);
      expect(result[0].unblock_requested).toBe(true);
    });
  });
});
