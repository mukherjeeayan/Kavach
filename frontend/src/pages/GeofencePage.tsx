import { useParams } from 'react-router-dom';
import { useGeofences } from '../hooks/useGeofencing';
import { SkeletonTable } from '../components/ui/Skeleton';
import GeofenceSection from '../components/dashboard/GeofenceSection';

export default function GeofencePage() {
  const { childId } = useParams<{ childId: string }>();
  const { isLoading } = useGeofences(childId!);

  if (isLoading) return <SkeletonTable rows={3} />;

  return (
    <div className="min-h-screen bg-background">
      <GeofenceSection childId={childId!} onError={() => {}} />
    </div>
  );
}