import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlockedAppsTable from './BlockedAppsTable';
import type { AppBlockRule } from '../../types/api';

vi.mock('../../hooks/useChildrenData', () => ({
  useSetAppDailyLimit: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

const baseRule = {
  device_id: 'device-1',
  is_blocked: true,
  block_reason: null,
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

describe('BlockedAppsTable', () => {
  it('shows empty state', () => {
    render(<BlockedAppsTable rules={[]} childId="child-1" />);
    expect(screen.getByText(/no blocked apps yet/i)).toBeInTheDocument();
  });

  it('renders blocked apps', () => {
    const rules: AppBlockRule[] = [
      { ...baseRule, id: 'r1', package_name: 'com.android.chrome', app_name: 'Chrome', daily_limit_minutes: 60, unblock_requested: false, unblock_reason: null },
      { ...baseRule, id: 'r2', package_name: 'com.instagram.android', app_name: 'Instagram', daily_limit_minutes: null, unblock_requested: true, unblock_reason: 'Need for school project' },
    ];
    render(<BlockedAppsTable rules={rules} childId="child-1" />);
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('60 min/day')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
