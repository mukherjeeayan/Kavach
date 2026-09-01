// admin.service.test.ts
// Unit tests for the admin panel service: user management, feature flags,
// system stats, and audit-logged mutations.

import * as adminService from '../admin.service';
import { query } from '../../../config/database';
import * as auditService from '../../shared/audit.service';
import { NotFoundError, BadRequestError } from '../../../utils/errors';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
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
const mockedAudit = auditService as jest.Mocked<typeof auditService>;

const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const FEATURE_FLAG_KEY = 'dark_mode';

const userRow: adminService.AdminUserRow = {
  id: USER_ID,
  email: 'user@test.com',
  name: 'Test User',
  role: 'parent',
  subscription_tier: 'FREE',
  trial_expires_at: null,
  subscription_updated_at: null,
  created_at: '2024-01-01T00:00:00.000Z',
  child_count: 2,
  payment_count: 1,
};

const flagRow: adminService.FeatureFlagRow = {
  id: 'flag-1',
  key: FEATURE_FLAG_KEY,
  description: 'Dark mode toggle',
  is_enabled: false,
  required_tier: 'FREE',
  updated_at: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

// ─── getSystemStats ──────────────────────────────────────────────────────────

describe('getSystemStats', () => {
  it('should return system stat counts', async () => {
    const stats = {
      total_users: 100,
      free_users: 60,
      active_trial_users: 10,
      expired_trial_users: 5,
      premium_users: 25,
      admin_users: 3,
      new_users_7d: 12,
      new_users_30d: 40,
    };
    mockedQuery.mockResolvedValueOnce({ rows: [stats] } as any);

    const result = await adminService.getSystemStats();

    expect(result).toEqual(stats);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(*)')
    );
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('should return zeroed stats when no parents exist', async () => {
    const stats = {
      total_users: 0,
      free_users: 0,
      active_trial_users: 0,
      expired_trial_users: 0,
      premium_users: 0,
      admin_users: 0,
      new_users_7d: 0,
      new_users_30d: 0,
    };
    mockedQuery.mockResolvedValueOnce({ rows: [stats] } as any);

    const result = await adminService.getSystemStats();

    expect(result.total_users).toBe(0);
    expect(result.premium_users).toBe(0);
  });
});

// ─── listUsers ───────────────────────────────────────────────────────────────

describe('listUsers', () => {
  it('should return paginated user list without search', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [userRow] } as any)   // users query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any); // count query

    const result = await adminService.listUsers(1, 20);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].id).toBe(USER_ID);
    expect(result.total).toBe(1);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM parents'),
      [20, 0]
    );
  });

  it('should apply search filter when search is provided', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [userRow] } as any)
      .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any);

    const result = await adminService.listUsers(1, 20, 'test');

    expect(result.users).toHaveLength(1);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE $3'),
      [20, 0, '%test%']
    );
  });

  it('should return empty list when no users match', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

    const result = await adminService.listUsers(1, 20, 'nonexistent');

    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should calculate correct offset for page 3 with limit 10', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

    await adminService.listUsers(3, 10);

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.any(String),
      [10, 20]
    );
  });
});

// ─── getUserById ─────────────────────────────────────────────────────────────

describe('getUserById', () => {
  it('should return a single user', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [userRow] } as any);

    const result = await adminService.getUserById(USER_ID);

    expect(result.id).toBe(USER_ID);
    expect(result.email).toBe('user@test.com');
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE p.id = $1'),
      [USER_ID]
    );
  });

  it('should throw NotFoundError when user does not exist', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    await expect(adminService.getUserById('nonexistent-id')).rejects.toThrow(
      NotFoundError
    );
  });
});

// ─── updateUserSubscription ──────────────────────────────────────────────────

describe('updateUserSubscription', () => {
  it('should update tier to PREMIUM and write audit log', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any) // UPDATE
      .mockResolvedValueOnce({ rows: [userRow] } as any); // getUserById

    const result = await adminService.updateUserSubscription(
      ADMIN_ID,
      USER_ID,
      'PREMIUM'
    );

    expect(result.id).toBe(USER_ID);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE parents'),
      ['PREMIUM', null, USER_ID]
    );
    expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        action: 'ADMIN_UPDATE_SUBSCRIPTION',
        details: expect.objectContaining({ tier: 'PREMIUM' }),
      })
    );
  });

  it('should set trial_expires_at when tier is TRIAL', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [userRow] } as any);

    await adminService.updateUserSubscription(ADMIN_ID, USER_ID, 'TRIAL', 14);

    const updateCall = mockedQuery.mock.calls[0];
    const trialDate = (updateCall[1] as any[])[1];
    expect(trialDate).not.toBeNull();
    expect(new Date(trialDate).getTime()).toBeGreaterThan(Date.now());
  });

  it('should accept lowercase tier and normalize to uppercase', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [userRow] } as any);

    await adminService.updateUserSubscription(ADMIN_ID, USER_ID, 'free');

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['FREE', null, USER_ID]
    );
  });

  it('should throw BadRequestError for invalid tier', async () => {
    await expect(
      adminService.updateUserSubscription(ADMIN_ID, USER_ID, 'ULTRA')
    ).rejects.toThrow(BadRequestError);
  });
});

// ─── updateUserRole ──────────────────────────────────────────────────────────

describe('updateUserRole', () => {
  it('should change role and write audit log', async () => {
    const adminUserRow = { ...userRow, role: 'admin' };
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any) // UPDATE
      .mockResolvedValueOnce({ rows: [adminUserRow] } as any); // getUserById

    const result = await adminService.updateUserRole(ADMIN_ID, USER_ID, 'admin');

    expect(result.role).toBe('admin');
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE parents SET role'),
      ['admin', USER_ID]
    );
    expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        action: 'ADMIN_UPDATE_ROLE',
        details: expect.objectContaining({ role: 'admin' }),
      })
    );
  });

  it('should throw BadRequestError for invalid role', async () => {
    await expect(
      adminService.updateUserRole(ADMIN_ID, USER_ID, 'superuser')
    ).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when admin tries to change own role', async () => {
    await expect(
      adminService.updateUserRole(ADMIN_ID, ADMIN_ID, 'parent')
    ).rejects.toThrow(BadRequestError);
  });
});

// ─── listFeatureFlags ────────────────────────────────────────────────────────

describe('listFeatureFlags', () => {
  it('should return all feature flags', async () => {
    const flags = [flagRow, { ...flagRow, key: 'new_feature', is_enabled: true }];
    mockedQuery.mockResolvedValueOnce({ rows: flags } as any);

    const result = await adminService.listFeatureFlags();

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe(FEATURE_FLAG_KEY);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM feature_flags')
    );
  });

  it('should return empty array when no flags exist', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const result = await adminService.listFeatureFlags();

    expect(result).toHaveLength(0);
  });
});

// ─── updateFeatureFlag ───────────────────────────────────────────────────────

describe('updateFeatureFlag', () => {
  it('should toggle is_enabled and write audit log', async () => {
    const updatedFlag = { ...flagRow, is_enabled: true };
    mockedQuery.mockResolvedValueOnce({ rows: [updatedFlag] } as any);

    const result = await adminService.updateFeatureFlag(
      ADMIN_ID,
      FEATURE_FLAG_KEY,
      { is_enabled: true }
    );

    expect(result.is_enabled).toBe(true);
    expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        action: 'ADMIN_UPDATE_FEATURE_FLAG',
        details: expect.objectContaining({ key: FEATURE_FLAG_KEY, is_enabled: true }),
      })
    );
  });

  it('should update required_tier', async () => {
    const updatedFlag = { ...flagRow, required_tier: 'PREMIUM' };
    mockedQuery.mockResolvedValueOnce({ rows: [updatedFlag] } as any);

    const result = await adminService.updateFeatureFlag(
      ADMIN_ID,
      FEATURE_FLAG_KEY,
      { required_tier: 'PREMIUM' }
    );

    expect(result.required_tier).toBe('PREMIUM');
  });

  it('should throw NotFoundError when flag key does not exist', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    await expect(
      adminService.updateFeatureFlag(ADMIN_ID, 'nonexistent', { is_enabled: true })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw BadRequestError for invalid required_tier', async () => {
    await expect(
      adminService.updateFeatureFlag(ADMIN_ID, FEATURE_FLAG_KEY, {
        required_tier: 'ULTRA',
      })
    ).rejects.toThrow(BadRequestError);
  });
});

// ─── Audit logging integration ───────────────────────────────────────────────

describe('audit logging', () => {
  it('should call writeAuditLog on updateUserSubscription', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [userRow] } as any);

    await adminService.updateUserSubscription(ADMIN_ID, USER_ID, 'FREE');

    expect(mockedAudit.writeAuditLog).toHaveBeenCalledTimes(1);
    expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ADMIN_ID,
        targetChildId: null,
        resourceType: 'parents',
      })
    );
  });

  it('should call writeAuditLog on updateUserRole', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [userRow] } as any);

    await adminService.updateUserRole(ADMIN_ID, USER_ID, 'parent');

    expect(mockedAudit.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it('should call writeAuditLog on updateFeatureFlag', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [flagRow] } as any);

    await adminService.updateFeatureFlag(ADMIN_ID, FEATURE_FLAG_KEY, {
      is_enabled: true,
    });

    expect(mockedAudit.writeAuditLog).toHaveBeenCalledTimes(1);
    expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_UPDATE_FEATURE_FLAG',
        resourceType: 'feature_flags',
      })
    );
  });

  it('should NOT call writeAuditLog on read-only operations', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [userRow] } as any)
      .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any);

    await adminService.listUsers(1, 20);
    expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();

    const statsRow = {
      total_users: 1,
      free_users: 1,
      active_trial_users: 0,
      expired_trial_users: 0,
      premium_users: 0,
      admin_users: 0,
      new_users_7d: 0,
      new_users_30d: 0,
    };
    mockedQuery.mockResolvedValueOnce({ rows: [statsRow] } as any);
    await adminService.getSystemStats();
    expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
  });
});
