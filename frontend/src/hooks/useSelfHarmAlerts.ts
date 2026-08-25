import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSelfHarmAlerts, acknowledgeSelfHarmAlert, fetchSelfHarmAlertCount } from '../services/api';

export const useSelfHarmAlerts = (childId: string | null, unacknowledgedOnly = false) =>
  useQuery({
    queryKey: ['selfHarmAlerts', childId, unacknowledgedOnly],
    queryFn: () => fetchSelfHarmAlerts(childId as string, unacknowledgedOnly),
    enabled: !!childId,
  });

export const useSelfHarmAlertCount = (childId: string | null) =>
  useQuery({
    queryKey: ['selfHarmAlertCount', childId],
    queryFn: () => fetchSelfHarmAlertCount(childId as string),
    enabled: !!childId,
  });

export const useAcknowledgeSelfHarmAlert = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => acknowledgeSelfHarmAlert(childId as string, alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['selfHarmAlerts', childId] });
      qc.invalidateQueries({ queryKey: ['selfHarmAlertCount', childId] });
    },
  });
};
