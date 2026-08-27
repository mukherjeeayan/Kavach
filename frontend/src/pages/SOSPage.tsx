import { useSosEvents, useAcknowledgeSos, useResolveSos } from '../hooks/useSos';
import { SkeletonList } from '../components/ui/Skeleton';
import EmergencySOS from '../components/dashboard/EmergencySOS';

interface Props {
  childId: string;
}

export default function SOSPage({ childId }: Props) {
  const { data: events, isLoading } = useSosEvents(childId);
  const acknowledge = useAcknowledgeSos(childId);
  const resolve = useResolveSos(childId);

  const activeEvents = (events ?? []).filter((e) => e.status === 'ACTIVE');
  const otherEvents = (events ?? []).filter((e) => e.status !== 'ACTIVE');

  if (isLoading) return <SkeletonList items={2} />;

  return (
    <div className="min-h-screen bg-background">
      <EmergencySOS childId={childId} onError={() => {}} />
      {/* Additional SOS page content could be added here */}
    </div>
  );
}