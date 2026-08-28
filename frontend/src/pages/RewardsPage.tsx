import { useRewardCatalog, useRewardPoints } from '../hooks/useRewards';
import { SkeletonCard } from '../components/ui/Skeleton';
import RewardSection from '../components/dashboard/RewardSection';

interface Props {
  childId: string;
}

export default function RewardsPage({ childId }: Props) {
  const { isLoading: catalogLoading } = useRewardCatalog();
  const { isLoading: pointsLoading } = useRewardPoints(childId);

  if (catalogLoading || pointsLoading) return <SkeletonCard />;

  return (
    <div className="min-h-screen bg-background">
      <RewardSection childId={childId} onError={() => {}} />
    </div>
  );
}