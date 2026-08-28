import { useGeofences } from '../hooks/useGeofencing';
import { SkeletonTable } from '../components/ui/Skeleton';
import GeofenceSection from '../components/dashboard/GeofenceSection';

interface Props {
  childId: string;
}

export default function GeofencePage({ childId }: Props) {
  const { isLoading } = useGeofences(childId);

  if (isLoading) return <SkeletonTable rows={3} />;

  return (
    <div className="min-h-screen bg-background">
      <GeofenceSection childId={childId} onError={() => {}} />
    </div>
  );
}