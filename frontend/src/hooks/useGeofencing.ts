import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGeofences, createGeofence, updateGeofence, deleteGeofence } from '../services/api';
import type { GeofenceInput } from '../types/api';

export const useGeofences = (childId: string | null) =>
  useQuery({
    queryKey: ['geofences', childId],
    queryFn: () => fetchGeofences(childId as string),
    enabled: !!childId,
  });

export const useCreateGeofence = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GeofenceInput) => createGeofence(childId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences', childId] }),
  });
};

export const useUpdateGeofence = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ geofenceId, input }: { geofenceId: string; input: Partial<GeofenceInput> }) =>
      updateGeofence(childId as string, geofenceId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences', childId] }),
  });
};

export const useDeleteGeofence = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (geofenceId: string) => deleteGeofence(childId as string, geofenceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences', childId] }),
  });
};
