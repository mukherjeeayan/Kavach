import { useQuery } from '@tanstack/react-query';
import { fetchMoodLogs, fetchMoodSummary } from '../services/api';

export const useMoodLogs = (childId: string | null, page = 1, limit = 20) =>
  useQuery({
    queryKey: ['moodLogs', childId, page, limit],
    queryFn: () => fetchMoodLogs(childId as string, page, limit),
    enabled: !!childId,
  });

export const useMoodSummary = (childId: string | null) =>
  useQuery({
    queryKey: ['moodSummary', childId],
    queryFn: () => fetchMoodSummary(childId as string),
    enabled: !!childId,
  });
