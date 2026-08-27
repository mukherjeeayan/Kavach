import { useRewardCatalog, useCreateRewardItem, useRewardPoints, useAwardPoints } from '../hooks/useRewards';
import { SkeletonCard } from '../components/ui/Skeleton';

interface Props {
  childId: string;
}

export default function RewardsPage({ childId }: Props) {
  const { data: catalog, isLoading: catalogLoading } = useRewardCatalog();
  const { data: points, isLoading: pointsLoading } = useRewardPoints(childId);

  if (catalogLoading || pointsLoading) return <SkeletonCard />;

  return (
    <div className="min-h-screen bg-background">
      <RewardSection childId={childId} onError={() => {}} />
      {/* Additional rewards page content could be added here */}
    </div>
  );
}