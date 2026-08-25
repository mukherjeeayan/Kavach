import { useQuery } from '@tanstack/react-query';
import { fetchMoodLogs, fetchMoodSummary } from '../services/api';

export const useMoodLogs = (childId: string | null) =>
  useQuery({
    queryKey: ['moodLogs', childId],
    queryFn: () => fetchMoodLogs(childId as string),
    enabled: !!childId,
  });

export const useMoodSummary = (childId: string | null) =>
  useQuery({
    queryKey: ['moodSummary', childId],
    queryFn: () => fetchMoodSummary(childId as string),
    enabled: !!childId,
  });
