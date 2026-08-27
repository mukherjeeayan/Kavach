import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUrlFilters,
  createUrlFilter,
  updateUrlFilter,
  deleteUrlFilter,
} from '../services/api';
import type { UrlFilterInput } from '../types/api';

export const useUrlFilters = (childId: string | null) =>
  useQuery({
    queryKey: ['urlFilters', childId],
    queryFn: () => fetchUrlFilters(childId as string),
    enabled: !!childId,
  });

export const useCreateUrlFilter = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UrlFilterInput) => createUrlFilter(childId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['urlFilters', childId] }),
  });
};

export const useUpdateUrlFilter = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: Partial<UrlFilterInput> }) =>
      updateUrlFilter(childId as string, ruleId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['urlFilters', childId] }),
  });
};

export const useDeleteUrlFilter = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteUrlFilter(childId as string, ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['urlFilters', childId] }),
  });
};
