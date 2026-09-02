// audit.service.test.ts
// Unit tests for writeAuditLog.

import { writeAuditLog } from '../audit.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { query } from '../../../config/database';
const mockedQuery = query as jest.MockedFunction<typeof query>;

beforeEach(() => {
  jest.clearAllMocks();
  // First call: SELECT for last sequence (returns empty), second call: INSERT
  mockedQuery
    .mockResolvedValueOnce({ rows: [] } as any) // sequence lookup
    .mockResolvedValueOnce({ rows: [] } as any); // insert
});

describe('audit.service - writeAuditLog', () => {
  it('inserts audit log with hash chain columns', async () => {
    await writeAuditLog({
      actorId: 'parent-1',
      targetChildId: 'child-2',
      action: 'TEST_EVENT',
      resourceType: 'test',
      details: { foo: 'bar' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    const [sql, params] = mockedQuery.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(sql).toContain('actor_id');
    expect(sql).toContain('target_child_id');
    expect(sql).toContain('action');
    expect(sql).toContain('resource_type');
    expect(sql).toContain('details');
    expect(sql).toContain('sequence_number');
    expect(sql).toContain('previous_hash');
    expect(sql).toContain('current_hash');
    expect(params[0]).toBe('parent-1');
    expect(params[1]).toBe('child-2');
    expect(params[2]).toBe('TEST_EVENT');
    expect(params[3]).toBe('test');
  });

  it('serialises details as JSON', async () => {
    await writeAuditLog({
      actorId: 'parent-1',
      targetChildId: null,
      action: 'DEVICE_ADMIN_STATUS',
      resourceType: 'device',
      details: { admin_active: false },
    });
    const params = mockedQuery.mock.calls[1][1] as unknown[];
    expect(JSON.parse(params[4] as string)).toEqual({ admin_active: false });
  });

  it('defaults missing details to an empty object', async () => {
    await writeAuditLog({
      actorId: 'parent-1',
      targetChildId: null,
      action: 'REFRESH_DEVICE',
      resourceType: 'devices',
    });
    const params = mockedQuery.mock.calls[1][1] as unknown[];
    expect(JSON.parse(params[4] as string)).toEqual({});
  });

  it('falls back to plain INSERT when hash chain fails', async () => {
    // Simulate hash chain query failure, then successful plain INSERT
    mockedQuery
      .mockReset()
      .mockRejectedValueOnce(new Error('column does not exist'))
      .mockResolvedValueOnce({ rows: [] } as any);

    await writeAuditLog({
      actorId: 'parent-1',
      targetChildId: null,
      action: 'TEST_EVENT',
      resourceType: 'test',
    });
    // Should have tried hash chain, then fallen back to plain INSERT
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    const [sql] = mockedQuery.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO audit_logs');
    // Plain INSERT should not have hash chain columns
    expect(sql).not.toContain('sequence_number');
  });
});
