import { useParams } from 'react-router-dom';
import { useSosEvents } from '../hooks/useSos';
import { SkeletonList } from '../components/ui/Skeleton';
import EmergencySOS from '../components/dashboard/EmergencySOS';

export default function SOSPage() {
  const { childId } = useParams<{ childId: string }>();
  const { isLoading } = useSosEvents(childId!);

  if (isLoading) return <SkeletonList items={2} />;

  return (
    <div className="min-h-screen bg-background">
      <EmergencySOS childId={childId!} onError={() => {}} />
    </div>
  );
}