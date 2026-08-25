import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateReport, fetchLatestReport, fetchReports } from '../services/api';

export const useGenerateReport = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportType: 'WEEKLY' | 'MONTHLY') => generateReport(childId as string, reportType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', childId] });
      qc.invalidateQueries({ queryKey: ['latestReport', childId] });
    },
  });
};

export const useLatestReport = (childId: string | null, reportType: 'WEEKLY' | 'MONTHLY') =>
  useQuery({
    queryKey: ['latestReport', childId, reportType],
    queryFn: () => fetchLatestReport(childId as string, reportType),
    enabled: !!childId,
  });

export const useReports = (childId: string | null) =>
  useQuery({
    queryKey: ['reports', childId],
    queryFn: () => fetchReports(childId as string),
    enabled: !!childId,
  });
