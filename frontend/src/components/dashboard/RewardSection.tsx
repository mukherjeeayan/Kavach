import { useState } from 'react';
import {
  useRewardCatalog,
  useCreateRewardItem,
  useRewardPoints,
  useAwardPoints,
  useRedeemReward,
  useRewardRedemptions,
  useUpdateRedemptionStatus,
} from '../../hooks/useRewards';
import { SkeletonCard } from '../ui/Skeleton';
import type { RewardRedemption } from '../../types/api';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
  childName?: string;
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'FULFILLED', label: 'Fulfilled' },
];

const STATUS_STYLES: Record<StatusFilter, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FULFILLED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function RewardSection({ childId, onError, childName }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState('100');
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [awardPoints, setAwardPoints] = useState('50');
  const [awardReason, setAwardReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');

  const { data: catalog, isLoading: catalogLoading } = useRewardCatalog();
  const { data: points, isLoading: pointsLoading } = useRewardPoints(childId);
  const { data: redemptions, isLoading: redemptionsLoading } = useRewardRedemptions(childId, statusFilter);
  const createItem = useCreateRewardItem();
  const awardPts = useAwardPoints(childId);
  const redeem = useRedeemReward(childId);
  const updateStatus = useUpdateRedemptionStatus(childId);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem.mutateAsync({
        name: newName,
        description: newDesc || undefined,
        cost_points: parseInt(newCost, 10) || 100,
      });
      setNewName(''); setNewDesc(''); setNewCost('100');
      setShowAddForm(false);
    } catch {
      onError('Failed to create reward item');
    }
  };

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await awardPts.mutateAsync({
        points: parseInt(awardPoints, 10) || 50,
        reason: awardReason || 'Good behavior',
        source: 'parent',
      });
      setAwardPoints('50'); setAwardReason('');
      setShowAwardForm(false);
    } catch {
      onError('Failed to award points');
    }
  };

  const handleRedeem = async (rewardId: string) => {
    try {
      await redeem.mutateAsync(rewardId);
    } catch {
      onError('Failed to redeem reward');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ redemptionId: id, status: 'APPROVED' });
    } catch {
      onError('Failed to approve redemption');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ redemptionId: id, status: 'REJECTED' });
    } catch {
      onError('Failed to reject redemption');
    }
  };

  if (catalogLoading || pointsLoading) return <SkeletonCard />;

  const totalPoints = points?.total_points ?? 0;
  const rewardNameById = new Map((catalog ?? []).map((c) => [c.id, c.name]));
  const redemptionList: RewardRedemption[] = redemptions ?? [];

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rewards</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Points balance: <span className="font-bold text-amber-600 dark:text-amber-400">{totalPoints}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAwardForm(!showAwardForm); setShowAddForm(false); }}
              className="px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 transition-colors"
            >
              Award Points
            </button>
            <button
              onClick={() => { setShowAddForm(!showAddForm); setShowAwardForm(false); }}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Reward
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {showAwardForm && (
          <form onSubmit={handleAward} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={awardPoints}
                onChange={(e) => setAwardPoints(e.target.value)}
                placeholder="Points"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="Reason (e.g., Completed homework)"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={awardPts.isPending}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {awardPts.isPending ? 'Awarding...' : 'Award Points'}
            </button>
          </form>
        )}

        {showAddForm && (
          <form onSubmit={handleCreateItem} className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Reward name"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="Cost (points)"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={createItem.isPending || !newName.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createItem.isPending ? 'Creating...' : 'Create Reward'}
            </button>
          </form>
        )}

        {/* Reward Catalog */}
        {(catalog ?? []).length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎁</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No rewards in the catalog yet. Add rewards for your child to redeem with their points!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(catalog ?? []).map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                  )}
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1">
                    {item.cost_points} points
                  </p>
                </div>
                <button
                  onClick={() => handleRedeem(item.id)}
                  disabled={redeem.isPending || totalPoints < item.cost_points}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 disabled:opacity-40 transition-colors"
                >
                  {totalPoints < item.cost_points ? 'Not enough' : 'Redeem'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Redemptions Queue */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Redemption Queue</h4>
          </div>
          <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Filter redemptions by status">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={statusFilter === tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {redemptionsLoading ? (
            <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">Loading redemptions...</div>
          ) : redemptionList.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No {statusFilter.toLowerCase()} redemptions.
              </p>
            </div>
          ) : (
            <div className="grid gap-2" data-testid="redemption-list">
              {redemptionList.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {rewardNameById.get(r.reward_id) ?? 'Unknown reward'}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {childName ?? `Child ${r.child_id.slice(0, 8)}`} &middot; {r.points_spent} points &middot; {new Date(r.redeemed_at).toLocaleDateString()}
                    </p>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={updateStatus.isPending}
                        aria-label="Approve redemption"
                        className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={updateStatus.isPending}
                        aria-label="Reject redemption"
                        className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
