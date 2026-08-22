import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnblockRequests from './UnblockRequests';
import type { AppBlockRule } from '../../types/api';

const baseRule = {
  device_id: 'device-1',
  is_blocked: true,
  block_reason: null,
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

describe('UnblockRequests', () => {
  const defaultProps = {
    rules: [] as AppBlockRule[],
    isPending: false,
    onApprove: vi.fn(),
    onReject: vi.fn(),
  };

  it('shows empty state', () => {
    render(<UnblockRequests {...defaultProps} />);
    expect(screen.getByText(/no pending unblock requests/i)).toBeInTheDocument();
  });

  it('renders unblock requests', () => {
    const rules: AppBlockRule[] = [
      { ...baseRule, id: 'r1', package_name: 'com.android.chrome', app_name: 'Chrome', unblock_requested: true, unblock_reason: 'Need for homework', daily_limit_minutes: null },
      { ...baseRule, id: 'r2', package_name: 'com.instagram.android', app_name: 'Instagram', unblock_requested: true, unblock_reason: null, daily_limit_minutes: null },
    ];
    render(<UnblockRequests {...defaultProps} rules={rules} />);
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText(/need for homework/i)).toBeInTheDocument();
    expect(screen.getByText(/no reason given/i)).toBeInTheDocument();
  });

  it('calls onApprove when Approve is clicked', () => {
    const onApprove = vi.fn();
    const rules: AppBlockRule[] = [
      { ...baseRule, id: 'r1', package_name: 'com.android.chrome', app_name: 'Chrome', unblock_requested: true, unblock_reason: null, daily_limit_minutes: null },
    ];
    render(<UnblockRequests {...defaultProps} rules={rules} onApprove={onApprove} />);
    screen.getByText('Approve').click();
    expect(onApprove).toHaveBeenCalledWith('r1');
  });

  it('calls onReject when Reject is clicked', () => {
    const onReject = vi.fn();
    const rules: AppBlockRule[] = [
      { ...baseRule, id: 'r1', package_name: 'com.android.chrome', app_name: 'Chrome', unblock_requested: true, unblock_reason: null, daily_limit_minutes: null },
    ];
    render(<UnblockRequests {...defaultProps} rules={rules} onReject={onReject} />);
    screen.getByText('Reject').click();
    expect(onReject).toHaveBeenCalledWith('r1');
  });
});
