import { useSosEvents } from '../hooks/useSos';
import { SkeletonList } from '../components/ui/Skeleton';
import EmergencySOS from '../components/dashboard/EmergencySOS';

interface Props {
  childId: string;
}

export default function SOSPage({ childId }: Props) {
  const { isLoading } = useSosEvents(childId);

  if (isLoading) return <SkeletonList items={2} />;

  return (
    <div className="min-h-screen bg-background">
      <EmergencySOS childId={childId} onError={() => {}} />
    </div>
  );
}