// reward.service.test.ts
// Unit tests for the reward catalog, points, and redemptions service.

import * as rewardService from '../reward.service';
import { query } from '../../../config/database';
import { NotFoundError, ForbiddenError } from '../../../utils/errors';
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
const REWARD_ID = '44444444-4444-4444-4444-444444444444';
const REDEMPTION_ID = '55555555-5555-5555-5555-555555555555';

const catalogRow = {
  id: REWARD_ID,
  parent_id: PARENT_ID,
  name: 'Extra Screen Time',
  description: '30 minutes extra screen time',
  cost_points: 50,
  icon: 'screen',
  is_active: true,
  created_at: new Date().toISOString(),
};

const pointsRow = {
  id: '66666666-6666-6666-6666-666666666666',
  child_id: CHILD_ID,
  points: 50,
  reason: 'Good behavior',
  source: 'PARENT',
  created_at: new Date().toISOString(),
};

const redemptionRow = {
  id: REDEMPTION_ID,
  child_id: CHILD_ID,
  reward_id: REWARD_ID,
  points_spent: 50,
  status: 'PENDING',
  parent_notes: null,
  redeemed_at: new Date().toISOString(),
  resolved_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('reward.service', () => {
  describe('listCatalog', () => {
    it('should return catalog items with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [catalogRow] } as any);

      const result = await rewardService.listCatalog(PARENT_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Extra Screen Time');
    });
  });

  describe('createCatalogItem', () => {
    it('should insert and audit a new catalog item', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [catalogRow] } as any);

      const result = await rewardService.createCatalogItem(PARENT_ID, {
        name: 'Extra Screen Time',
        description: '30 minutes extra screen time',
        cost_points: 50,
        icon: 'screen',
      });

      expect(result.id).toBe(REWARD_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reward_catalog'),
        [PARENT_ID, 'Extra Screen Time', '30 minutes extra screen time', 50, 'screen']
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REWARD_CATALOG_CREATED' })
      );
    });
  });

  describe('updateCatalogItem', () => {
    it('should update and audit an existing catalog item', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ ...catalogRow, name: 'Updated Reward' }] } as any);

      const result = await rewardService.updateCatalogItem(PARENT_ID, REWARD_ID, {
        name: 'Updated Reward',
      });

      expect(result.name).toBe('Updated Reward');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REWARD_CATALOG_UPDATED' })
      );
    });

    it('should throw NotFoundError when catalog item does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        rewardService.updateCatalogItem(PARENT_ID, REWARD_ID, { name: 'Nope' })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('deleteCatalogItem', () => {
    it('should delete and audit an existing catalog item', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      await expect(
        rewardService.deleteCatalogItem(PARENT_ID, REWARD_ID)
      ).resolves.toBeUndefined();
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REWARD_CATALOG_DELETED' })
      );
    });

    it('should throw NotFoundError when catalog item does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      await expect(
        rewardService.deleteCatalogItem(PARENT_ID, REWARD_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('awardPoints', () => {
    it('should verify ownership, insert points and audit', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [pointsRow] } as any);

      const result = await rewardService.awardPoints(PARENT_ID, CHILD_ID, {
        child_id: CHILD_ID,
        points: 50,
        reason: 'Good behavior',
        source: 'PARENT',
      });

      expect(result.points).toBe(50);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reward_points'),
        [CHILD_ID, 50, 'Good behavior', 'PARENT']
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'POINTS_AWARDED', targetChildId: CHILD_ID })
      );
    });
  });

  describe('getPointsBalance', () => {
    it('should verify ownership and return points balance', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ balance: 150 }] } as any);

      const result = await rewardService.getPointsBalance(PARENT_ID, CHILD_ID);

      expect(result).toBe(150);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('redeemReward', () => {
    it('should deduct points and create redemption record', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ parent_id: PARENT_ID }] } as any) // child lookup
        .mockResolvedValueOnce({ rows: [catalogRow] } as any) // reward lookup
        .mockResolvedValueOnce({ rows: [{ balance: 100 }] } as any) // balance check
        .mockResolvedValueOnce({ rows: [] } as any) // deduct points
        .mockResolvedValueOnce({ rows: [redemptionRow] } as any); // create redemption

      const result = await rewardService.redeemReward(PARENT_ID, CHILD_ID, {
        reward_id: REWARD_ID,
      });

      expect(result.id).toBe(REDEMPTION_ID);
      expect(result.points_spent).toBe(50);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REWARD_REDEEMED', targetChildId: CHILD_ID })
      );
    });

    it('should throw NotFoundError when reward is not found or inactive', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ parent_id: PARENT_ID }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        rewardService.redeemReward(PARENT_ID, CHILD_ID, { reward_id: REWARD_ID })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when child has insufficient points', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ parent_id: PARENT_ID }] } as any)
        .mockResolvedValueOnce({ rows: [catalogRow] } as any)
        .mockResolvedValueOnce({ rows: [{ balance: 10 }] } as any);

      await expect(
        rewardService.redeemReward(PARENT_ID, CHILD_ID, { reward_id: REWARD_ID })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('resolveRedemption', () => {
    it('should approve a redemption and audit', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ ...redemptionRow, status: 'APPROVED', resolved_at: new Date().toISOString() }],
      } as any);

      const result = await rewardService.resolveRedemption(
        PARENT_ID,
        CHILD_ID,
        REDEMPTION_ID,
        'APPROVED',
        'Looks good'
      );

      expect(result.status).toBe('APPROVED');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REDEMPTION_APPROVED', targetChildId: CHILD_ID })
      );
    });

    it('should refund points when redemption is rejected', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [{ ...redemptionRow, status: 'REJECTED', points_spent: 50 }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // refund insert

      await rewardService.resolveRedemption(
        PARENT_ID,
        CHILD_ID,
        REDEMPTION_ID,
        'REJECTED'
      );

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reward_points'),
        [CHILD_ID, 50, expect.stringContaining('Refund')]
      );
    });

    it('should throw NotFoundError when redemption does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        rewardService.resolveRedemption(PARENT_ID, CHILD_ID, REDEMPTION_ID, 'APPROVED')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
