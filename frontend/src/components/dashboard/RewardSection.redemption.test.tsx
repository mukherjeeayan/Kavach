import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RewardSection from './RewardSection';

vi.mock('../../hooks/useRewards', () => ({
  useRewardCatalog: vi.fn(),
  useCreateRewardItem: vi.fn(),
  useRewardPoints: vi.fn(),
  useAwardPoints: vi.fn(),
  useRedeemReward: vi.fn(),
  useRewardRedemptions: vi.fn(),
  useUpdateRedemptionStatus: vi.fn(),
}));

import {
  useRewardCatalog,
  useCreateRewardItem,
  useRewardPoints,
  useAwardPoints,
  useRedeemReward,
  useRewardRedemptions,
  useUpdateRedemptionStatus,
} from '../../hooks/useRewards';

const mockedUseRewardCatalog = useRewardCatalog as ReturnType<typeof vi.fn>;
const mockedUseCreateRewardItem = useCreateRewardItem as ReturnType<typeof vi.fn>;
const mockedUseRewardPoints = useRewardPoints as ReturnType<typeof vi.fn>;
const mockedUseAwardPoints = useAwardPoints as ReturnType<typeof vi.fn>;
const mockedUseRedeemReward = useRedeemReward as ReturnType<typeof vi.fn>;
const mockedUseRewardRedemptions = useRewardRedemptions as ReturnType<typeof vi.fn>;
const mockedUseUpdateRedemptionStatus = useUpdateRedemptionStatus as ReturnType<typeof vi.fn>;

const sampleCatalog = [
  { id: 'rw1', name: 'Movie Night', description: 'Family movie', cost_points: 200, is_active: true, created_at: '', updated_at: '' },
];

const sampleRedemptions = [
  {
    id: 'red1',
    reward_id: 'rw1',
    child_id: 'child-1',
    points_spent: 200,
    status: 'PENDING' as const,
    redeemed_at: '2026-01-15T10:00:00Z',
    approved_at: null,
    fulfilled_at: null,
    notes: null,
  },
];

describe('RewardSection redemption queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateRewardItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseAwardPoints.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseRedeemReward.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders the redemption queue with status filter tabs', () => {
    mockedUseRewardCatalog.mockReturnValue({ data: sampleCatalog, isLoading: false });
    mockedUseRewardPoints.mockReturnValue({ data: { total_points: 500, child_id: 'child-1' }, isLoading: false });
    mockedUseRewardRedemptions.mockReturnValue({ data: sampleRedemptions, isLoading: false });
    mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<RewardSection childId="child-1" onError={vi.fn()} childName="Alice" />);

    expect(screen.getByText(/redemption queue/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /approved/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /rejected/i })).toBeInTheDocument();
  });

  it('displays redemption details: reward name, child name, points cost, status, date', () => {
    mockedUseRewardCatalog.mockReturnValue({ data: sampleCatalog, isLoading: false });
    mockedUseRewardPoints.mockReturnValue({ data: { total_points: 500, child_id: 'child-1' }, isLoading: false });
    mockedUseRewardRedemptions.mockReturnValue({ data: sampleRedemptions, isLoading: false });
    mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<RewardSection childId="child-1" onError={vi.fn()} childName="Alice" />);

    const list = screen.getByTestId('redemption-list');
    expect(list).toBeInTheDocument();
    expect(within(list).getByText('Movie Night')).toBeInTheDocument();
    expect(within(list).getByText(/alice/i)).toBeInTheDocument();
    expect(within(list).getByText(/200 points/i)).toBeInTheDocument();
    expect(within(list).getByText('PENDING')).toBeInTheDocument();
  });

  it('calls updateRedemptionStatus with approved when the approve button is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseRewardCatalog.mockReturnValue({ data: sampleCatalog, isLoading: false });
    mockedUseRewardPoints.mockReturnValue({ data: { total_points: 500, child_id: 'child-1' }, isLoading: false });
    mockedUseRewardRedemptions.mockReturnValue({ data: sampleRedemptions, isLoading: false });
    mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync, isPending: false });

    render(<RewardSection childId="child-1" onError={vi.fn()} childName="Alice" />);

    fireEvent.click(screen.getByRole('button', { name: /approve redemption/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      redemptionId: 'red1',
      status: 'APPROVED',
    });
  });

  it('calls updateRedemptionStatus with rejected when the reject button is clicked and refetches by status', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseRewardCatalog.mockReturnValue({ data: sampleCatalog, isLoading: false });
    mockedUseRewardPoints.mockReturnValue({ data: { total_points: 500, child_id: 'child-1' }, isLoading: false });
    mockedUseRewardRedemptions.mockReturnValue({ data: sampleRedemptions, isLoading: false });
    mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync, isPending: false });

    render(<RewardSection childId="child-1" onError={vi.fn()} childName="Alice" />);

    fireEvent.click(screen.getByRole('button', { name: /reject redemption/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      redemptionId: 'red1',
      status: 'REJECTED',
    });

    fireEvent.click(screen.getByRole('tab', { name: /approved/i }));
    expect(mockedUseRewardRedemptions).toHaveBeenCalledWith('child-1', 'APPROVED');
  });
});
