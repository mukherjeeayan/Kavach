import { useGeofences, useCreateGeofence, useUpdateGeofence, useDeleteGeofence } from '../hooks/useGeofencing';
import { SkeletonTable } from '../components/ui/Skeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface Props {
  childId: string;
}

export default function GeofencePage({ childId }: Props) {
  const { data: geofences, isLoading } = useGeofences(childId);
  const createGeo = useCreateGeofence(childId);
  const deleteGeo = useDeleteGeofence(childId);

  if (isLoading) return <SkeletonTable rows={3} />;

  const geofenceList = geofences ?? [];

  return (
    <div className="min-h-screen bg-background">
      <GeofenceSection childId={childId} onError={() => {}} />
      {/* Additional geofence page content could be added here */}
    </div>
  );
}