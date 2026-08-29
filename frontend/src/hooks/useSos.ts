import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSosEvents, acknowledgeSos, resolveSos } from '../services/api';

export const useSosEvents = (childId: string | null, status?: string, page = 1, limit = 10) =>
  useQuery({
    queryKey: ['sos', childId, status, page, limit],
    queryFn: () => fetchSosEvents(childId as string, status, page, limit),
    enabled: !!childId,
  });

export const useAcknowledgeSos = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => acknowledgeSos(childId as string, eventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos', childId] }),
  });
};

export const useResolveSos = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, notes }: { eventId: string; notes?: string }) =>
      resolveSos(childId as string, eventId, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos', childId] }),
  });
};
