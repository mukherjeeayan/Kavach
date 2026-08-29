// integration.sync.test.ts
// Unit tests for the real sync pipeline in integration.service.
// Mocks the `query` helper and `fetch` so we can exercise every branch
// (per-type API call, retry, 4xx-no-retry, success/error status, unknown type).

import * as integrationService from '../integration.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as auditService from '../../shared/audit.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedAudit = auditService as jest.Mocked<typeof auditService>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const INTEGRATION_ID = '44444444-4444-4444-4444-444444444444';

const baseIntegrationRow = (overrides: Record<string, any> = {}) => ({
  id: INTEGRATION_ID,
  parent_id: PARENT_ID,
  integration_type: 'CALENDAR',
  name: 'Test Calendar',
  config: { access_token: 'fake-token' },
  is_active: true,
  ...overrides,
});

const okResponse = (body: any = {}): any => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue(body),
});

const errorResponse = (status: number): any => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue({}),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
  // jsdom/node fetch polyfill is missing in tests; install a global stub
  // that each test overrides.
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  delete (global as any).fetch;
});

describe('integration.service syncIntegration', () => {
  it('throws NotFoundError when integration is missing', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    await expect(
      integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID)
    ).rejects.toThrow(NotFoundError);
    expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('syncGoogleCalendar makes API call and updates status to success', async () => {
    const row = baseIntegrationRow({
      integration_type: 'CALENDAR',
      config: { access_token: 'tok' },
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    ((global as any).fetch as jest.Mock).mockResolvedValueOnce(
      okResponse({ items: [{ id: 'e1' }, { id: 'e2' }] })
    );

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global as any).fetch.mock.calls[0];
    expect(url).toContain('googleapis.com/calendar/v3/calendars/primary/events');
    expect(url).toContain('maxResults=10');
    expect(options.headers.Authorization).toBe('Bearer tok');

    // Second query is the UPDATE that records success
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    const updateCall = mockedQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE integrations/);
    expect(updateCall[0]).toMatch(/sync_status = \$1/);
    expect(updateCall[1]).toEqual(['success', null, INTEGRATION_ID]);

    expect(result.status).toBe('success');
    expect(result.details).toBeUndefined();
    expect(result.syncedAt).toBeInstanceOf(Date);

    expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INTEGRATION_SYNCED',
        details: expect.objectContaining({ status: 'success' }),
      })
    );
  });

  it('retries on network error then succeeds', async () => {
    const row = baseIntegrationRow({
      integration_type: 'CALENDAR',
      config: { access_token: 'tok' },
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce(okResponse({ items: [] }));

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('success');
    const updateParams = mockedQuery.mock.calls[1]?.[1] as any[] | undefined;
    expect(updateParams?.[0]).toBe('success');
  });

  it('does not retry on 4xx errors', async () => {
    const row = baseIntegrationRow({
      integration_type: 'CALENDAR',
      config: { access_token: 'tok' },
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(errorResponse(401));

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('error');
    expect(result.details).toBe('Google API returned 401');
    expect(mockedQuery.mock.calls[1][1]).toEqual(['error', 'Google API returned 401', INTEGRATION_ID]);
  });

  it('updates last_sync_at on success', async () => {
    const row = baseIntegrationRow({
      integration_type: 'CALENDAR',
      config: { access_token: 'tok' },
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    ((global as any).fetch as jest.Mock).mockResolvedValueOnce(okResponse({ items: [] }));

    await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    const updateSql = mockedQuery.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/last_sync_at\s*=\s*NOW\(\)/);
  });

  it('sets error status when sync throws after exhausting retries', async () => {
    const row = baseIntegrationRow({
      integration_type: 'HEALTH_APP',
      config: { access_token: 'tok' },
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock
      .mockRejectedValueOnce(new Error('boom-1'))
      .mockRejectedValueOnce(new Error('boom-2'))
      .mockRejectedValueOnce(new Error('boom-3'));

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('error');
    expect(result.details).toBe('boom-3');
    expect(mockedQuery.mock.calls[1][1]).toEqual(['error', 'boom-3', INTEGRATION_ID]);
  });

  it('returns error for unknown integration_type', async () => {
    const row = baseIntegrationRow({ integration_type: 'BOGUS' });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(result.details).toContain('Unknown integration type: BOGUS');
    expect(mockedQuery.mock.calls[1][1]).toEqual([
      'error',
      `Unknown integration type: BOGUS`,
      INTEGRATION_ID,
    ]);
  });

  it('returns error when health integration has no access token', async () => {
    const row = baseIntegrationRow({
      integration_type: 'HEALTH_APP',
      config: {},
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(result.details).toBe('Missing access token');
  });

  it('posts to school portal webhook', async () => {
    const row = baseIntegrationRow({
      integration_type: 'SCHOOL_PORTAL',
      config: { webhook_url: 'https://school.example/sync' },
    });
    mockedQuery
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    ((global as any).fetch as jest.Mock).mockResolvedValueOnce(okResponse({}));

    const result = await integrationService.syncIntegration(PARENT_ID, INTEGRATION_ID);

    const fetchMock = (global as any).fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://school.example/sync');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.action).toBe('sync');
    expect(typeof body.timestamp).toBe('string');
    expect(result.status).toBe('success');
  });
});
