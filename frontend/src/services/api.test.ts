import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from './apiClient';
import {
  fetchChildAlerts,
  fetchChildren,
  setScreenTimeLimit,
} from './api';

const envelope = <T>(data: T) => ({
  success: true,
  data,
  error: null,
  timestamp: '2026-08-19T00:00:00.000Z',
  request_id: 'test-request',
});

const mockedGet = apiClient.get as ReturnType<typeof vi.fn>;

describe('api layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchChildren returns an empty list when the payload is absent', async () => {
    mockedGet.mockResolvedValue({ data: envelope(null) });
    const children = await fetchChildren();
    expect(children).toEqual([]);
    expect(apiClient.get).toHaveBeenCalledWith('/children');
  });

  it('fetchChildAlerts maps the alerts envelope', async () => {
    const alerts = [
      {
        action: 'SCREEN_TIME_LIMIT_REACHED',
        resource_type: 'audit_logs',
        details: { limit_minutes: 60, total_minutes: 75 },
        created_at: '2026-08-19T10:00:00.000Z',
      },
    ];
    mockedGet.mockResolvedValue({ data: envelope({ alerts }) });
    const result = await fetchChildAlerts('child-1');
    expect(result).toEqual(alerts);
    expect(apiClient.get).toHaveBeenCalledWith('/children/child-1/alerts');
  });

  it('setScreenTimeLimit posts limit_minutes and returns the child', async () => {
    const child = { id: 'child-1', daily_screen_time_limit_minutes: 60 };
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: envelope({ child }),
    });
    const result = await setScreenTimeLimit('child-1', 60);
    expect(result).toEqual(child);
    expect(apiClient.put).toHaveBeenCalledWith('/children/child-1/screen-time-limit', {
      limit_minutes: 60,
    });
  });

  it('setScreenTimeLimit clears the limit with null', async () => {
    const child = { id: 'child-1', daily_screen_time_limit_minutes: null };
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: envelope({ child }),
    });
    const result = await setScreenTimeLimit('child-1', null);
    expect(result).toEqual(child);
    expect(apiClient.put).toHaveBeenCalledWith('/children/child-1/screen-time-limit', {
      limit_minutes: null,
    });
  });
});