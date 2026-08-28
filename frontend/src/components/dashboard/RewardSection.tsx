import { useState } from 'react';
import { useRewardCatalog, useCreateRewardItem, useRewardPoints, useAwardPoints, useRedeemReward } from '../../hooks/useRewards';
import { SkeletonCard } from '../ui/Skeleton';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

export default function RewardSection({ childId, onError }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState('100');
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [awardPoints, setAwardPoints] = useState('50');
  const [awardReason, setAwardReason] = useState('');

  const { data: catalog, isLoading: catalogLoading } = useRewardCatalog();
  const { data: points, isLoading: pointsLoading } = useRewardPoints(childId);
  const createItem = useCreateRewardItem();
  const awardPts = useAwardPoints(childId);
  const redeem = useRedeemReward(childId);

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

  if (catalogLoading || pointsLoading) return <SkeletonCard />;

  const totalPoints = points?.total_points ?? 0;

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
      </div>
    </section>
  );
}
