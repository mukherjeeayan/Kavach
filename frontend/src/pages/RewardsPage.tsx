import { useParams } from 'react-router-dom';
import { useRewardCatalog, useRewardPoints } from '../hooks/useRewards';
import { SkeletonCard } from '../components/ui/Skeleton';
import RewardSection from '../components/dashboard/RewardSection';

export default function RewardsPage() {
  const { childId } = useParams<{ childId: string }>();
  const { isLoading: catalogLoading } = useRewardCatalog();
  const { isLoading: pointsLoading } = useRewardPoints(childId!);

  if (catalogLoading || pointsLoading) return <SkeletonCard />;

  return (
    <div className="min-h-screen bg-background">
      <RewardSection childId={childId!} onError={() => {}} />
    </div>
  );
}