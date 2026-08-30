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
  mockedQuery.mockResolvedValue({ rows: [] } as any);
});

describe('audit.service - writeAuditLog', () => {
  it('inserts the required 5 columns into audit_logs', async () => {
    await writeAuditLog({
      actorId: 'parent-1',
      targetChildId: 'child-2',
      action: 'TEST_EVENT',
      resourceType: 'test',
      details: { foo: 'bar' },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockedQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(sql).toContain('actor_id');
    expect(sql).toContain('target_child_id');
    expect(sql).toContain('action');
    expect(sql).toContain('resource_type');
    expect(sql).toContain('details');
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
    const params = mockedQuery.mock.calls[0][1] as unknown[];
    expect(JSON.parse(params[4] as string)).toEqual({ admin_active: false });
  });

  it('defaults missing details to an empty object', async () => {
    await writeAuditLog({
      actorId: 'parent-1',
      targetChildId: null,
      action: 'REFRESH_DEVICE',
      resourceType: 'devices',
    });
    const params = mockedQuery.mock.calls[0][1] as unknown[];
    expect(JSON.parse(params[4] as string)).toEqual({});
  });
});
