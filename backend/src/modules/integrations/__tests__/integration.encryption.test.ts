// integration-encryption.test.ts
// Verifies that OAuth tokens / webhook URLs in the integrations
// config JSONB column are stored encrypted (ciphertext envelope).

import * as integrationService from '../integration.service';
import { query } from '../../../config/database';
import { encryptSensitiveData, decryptSensitiveData } from '../../shared/encryption.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../config/validateEnv', () => ({
  env: { isProduction: false, NODE_ENV: 'test' },
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
const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const INTEGRATION_ID = '44444444-4444-4444-4444-444444444444';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('integration.config - OAuth tokens encrypted at rest', () => {
  it('createIntegration stores the ciphertext envelope, not plaintext', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{
        id: INTEGRATION_ID,
        parent_id: PARENT_ID,
        integration_type: 'CALENDAR',
        name: 'Calendar',
        config: { _encrypted: true, ct: encryptSensitiveData(JSON.stringify({ access_token: 'plain-on-write-test' })) },
      }],
    } as any);

    await integrationService.createIntegration(PARENT_ID, {
      integration_type: 'CALENDAR',
      name: 'Calendar',
      config: { access_token: 'plain-on-write-test' },
    });

    const insertCall = mockedQuery.mock.calls[0];
    expect(insertCall[0]).toEqual(expect.stringContaining('INSERT INTO integrations'));
    const storedConfig = JSON.parse((insertCall[1] as unknown[])[3] as string);
    expect(storedConfig._encrypted).toBe(true);
    expect(typeof storedConfig.ct).toBe('string');
    expect(JSON.stringify(storedConfig)).not.toContain('plain-on-write-test');
    expect(decryptSensitiveData(storedConfig.ct)).toBe(JSON.stringify({ access_token: 'plain-on-write-test' }));
  });

  it('listIntegrations decrypts the config before returning', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{
        id: INTEGRATION_ID,
        parent_id: PARENT_ID,
        integration_type: 'CALENDAR',
        name: 'Calendar',
        config: { _encrypted: true, ct: encryptSensitiveData(JSON.stringify({ access_token: 'tok-123' })) },
      }],
    } as any);

    const result = await integrationService.listIntegrations(PARENT_ID);

    expect(result[0].config).toEqual({ access_token: 'tok-123' });
    expect(JSON.stringify(result[0])).toContain('tok-123');
  });

  it('updateIntegration stores the new ciphertext envelope', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{
        id: INTEGRATION_ID,
        parent_id: PARENT_ID,
        integration_type: 'CALENDAR',
        name: 'Calendar',
        config: { _encrypted: true, ct: encryptSensitiveData(JSON.stringify({ access_token: 'rotated' })) },
      }],
    } as any);

    await integrationService.updateIntegration(PARENT_ID, INTEGRATION_ID, {
      config: { access_token: 'rotated' },
    });

    const updateCall = mockedQuery.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.stringContaining('UPDATE integrations'));
    const storedConfig = JSON.parse((updateCall[1] as unknown[])[3] as string);
    expect(storedConfig._encrypted).toBe(true);
    expect(JSON.stringify(storedConfig)).not.toContain('rotated');
    expect(decryptSensitiveData(storedConfig.ct)).toBe(JSON.stringify({ access_token: 'rotated' }));
  });

  it('syncIntegration uses the decrypted access_token', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{
          id: INTEGRATION_ID,
          parent_id: PARENT_ID,
          integration_type: 'CALENDAR',
          name: 'Calendar',
          is_active: true,
          config: { _encrypted: true, ct: encryptSensitiveData(JSON.stringify({ access_token: 'sync-tok' })) },
        }],
      } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ items: [] }),
    });

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect(result.status).toBe('success');
    const fetchCall = (global as any).fetch.mock.calls[0];
    expect(fetchCall[1].headers.Authorization).toBe('Bearer sync-tok');
  });
});
