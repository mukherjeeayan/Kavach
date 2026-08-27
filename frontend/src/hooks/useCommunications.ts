import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCommunicationLogs,
  fetchKeywordAlerts,
  reviewKeywordAlert,
} from '../services/api';

export const useCommunicationLogs = (
  childId: string | null,
  flaggedOnly = false,
  page = 1,
  limit = 50
) =>
  useQuery({
    queryKey: ['communications', childId, flaggedOnly, page],
    queryFn: () => fetchCommunicationLogs(childId ?? '', flaggedOnly, page, limit),
    enabled: !!childId,
  });

export const useKeywordAlerts = (childId: string | null, unreviewedOnly = false) =>
  useQuery({
    queryKey: ['keywordAlerts', childId, unreviewedOnly],
    queryFn: () => fetchKeywordAlerts(childId ?? '', unreviewedOnly),
    enabled: !!childId,
  });

export const useReviewKeywordAlert = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => reviewKeywordAlert(childId ?? '', alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keywordAlerts', childId ?? ''] }),
  });
};