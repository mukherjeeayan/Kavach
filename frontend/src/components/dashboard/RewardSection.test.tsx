import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

vi.mock('../ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
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
  { id: 'rw2', name: 'Extra Playtime', description: null, cost_points: 50, is_active: true, created_at: '', updated_at: '' },
];

function setupDefaultMocks() {
  mockedUseRewardCatalog.mockReturnValue({ data: sampleCatalog, isLoading: false });
  mockedUseRewardPoints.mockReturnValue({ data: { total_points: 500 }, isLoading: false });
  mockedUseRewardRedemptions.mockReturnValue({ data: [], isLoading: false });
  mockedUseCreateRewardItem.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  mockedUseAwardPoints.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  mockedUseRedeemReward.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
}

describe('RewardSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching catalog or points', () => {
    mockedUseRewardCatalog.mockReturnValue({ data: undefined, isLoading: true });
    mockedUseRewardPoints.mockReturnValue({ data: undefined, isLoading: true });
    mockedUseRewardRedemptions.mockReturnValue({ data: [], isLoading: false });
    mockedUseCreateRewardItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseAwardPoints.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseRedeemReward.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
  });

  it('renders heading with points balance', () => {
    setupDefaultMocks();
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Rewards')).toBeInTheDocument();
    expect(screen.getByText(/points balance:/i)).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders catalog items with name, description, and cost', () => {
    setupDefaultMocks();
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Movie Night')).toBeInTheDocument();
    expect(screen.getByText('Family movie')).toBeInTheDocument();
    expect(screen.getByText(/200 points/)).toBeInTheDocument();
    expect(screen.getByText('Extra Playtime')).toBeInTheDocument();
    expect(screen.getByText(/50 points/)).toBeInTheDocument();
  });

  it('shows empty state when catalog is empty', () => {
    mockedUseRewardCatalog.mockReturnValue({ data: [], isLoading: false });
    mockedUseRewardPoints.mockReturnValue({ data: { total_points: 0 }, isLoading: false });
    mockedUseRewardRedemptions.mockReturnValue({ data: [], isLoading: false });
    mockedUseCreateRewardItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseAwardPoints.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseRedeemReward.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseUpdateRedemptionStatus.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no rewards in the catalog yet/i)).toBeInTheDocument();
  });

  it('shows Not enough when points are insufficient', () => {
    setupDefaultMocks();
    mockedUseRewardPoints.mockReturnValue({ data: { total_points: 30 }, isLoading: false });
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    const notEnoughButtons = screen.getAllByText('Not enough');
    expect(notEnoughButtons.length).toBeGreaterThanOrEqual(1);
    expect(notEnoughButtons[0]).toBeDisabled();
  });

  it('opens the Award Points form when Award Points button is clicked', () => {
    setupDefaultMocks();
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Award Points')[0]);
    expect(screen.getByPlaceholderText('Points')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument();
    expect(screen.getAllByText('Award Points').length).toBeGreaterThanOrEqual(2);
  });

  it('opens the Add Reward form when + Add Reward button is clicked', () => {
    setupDefaultMocks();
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Reward'));
    expect(screen.getByPlaceholderText('Reward name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cost/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create reward/i })).toBeInTheDocument();
  });

  it('closes Add Reward form and opens Award Points form when toggling', () => {
    setupDefaultMocks();
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Reward'));
    expect(screen.getByPlaceholderText('Reward name')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Award Points')[0]);
    expect(screen.queryByPlaceholderText('Reward name')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Points')).toBeInTheDocument();
  });

  it('submits award points form and calls mutateAsync', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupDefaultMocks();
    mockedUseAwardPoints.mockReturnValue({ mutateAsync, isPending: false });
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Award Points')[0]);
    fireEvent.change(screen.getByPlaceholderText('Points'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'Good behavior' } });
    fireEvent.click(screen.getAllByText('Award Points')[1]);
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        points: 100,
        reason: 'Good behavior',
        source: 'parent',
      });
    });
  });

  it('submits create reward form and calls mutateAsync', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupDefaultMocks();
    mockedUseCreateRewardItem.mockReturnValue({ mutateAsync, isPending: false });
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Reward'));
    fireEvent.change(screen.getByPlaceholderText('Reward name'), { target: { value: 'New Reward' } });
    fireEvent.change(screen.getByPlaceholderText(/cost/i), { target: { value: '75' } });
    fireEvent.change(screen.getByPlaceholderText(/description/i), { target: { value: 'A test reward' } });
    fireEvent.click(screen.getByRole('button', { name: /create reward/i }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'New Reward',
        description: 'A test reward',
        cost_points: 75,
      });
    });
  });

  it('calls onError when award points fails', async () => {
    const onError = vi.fn();
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    setupDefaultMocks();
    mockedUseAwardPoints.mockReturnValue({ mutateAsync, isPending: false });
    render(<RewardSection childId="child-1" onError={onError} />);
    fireEvent.click(screen.getAllByText('Award Points')[0]);
    fireEvent.click(screen.getAllByText('Award Points')[1]);
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to award points');
    });
  });

  it('calls onError when create reward fails', async () => {
    const onError = vi.fn();
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    setupDefaultMocks();
    mockedUseCreateRewardItem.mockReturnValue({ mutateAsync, isPending: false });
    render(<RewardSection childId="child-1" onError={onError} />);
    fireEvent.click(screen.getByText('+ Add Reward'));
    fireEvent.change(screen.getByPlaceholderText('Reward name'), { target: { value: 'Fail Reward' } });
    fireEvent.click(screen.getByRole('button', { name: /create reward/i }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to create reward item');
    });
  });

  it('calls redeem when Redeem button is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupDefaultMocks();
    mockedUseRedeemReward.mockReturnValue({ mutateAsync, isPending: false });
    render(<RewardSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Redeem')[0]);
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('rw1');
    });
  });

  it('calls onError when redeem fails', async () => {
    const onError = vi.fn();
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    setupDefaultMocks();
    mockedUseRedeemReward.mockReturnValue({ mutateAsync, isPending: false });
    render(<RewardSection childId="child-1" onError={onError} />);
    fireEvent.click(screen.getAllByText('Redeem')[0]);
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to redeem reward');
    });
  });
});
