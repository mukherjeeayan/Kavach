import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  syncIntegration,
} from '../services/api';

export const useIntegrations = () =>
  useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
  });

export const useCreateIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createIntegration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};

export const useUpdateIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; config?: Record<string, unknown>; is_active?: boolean }) =>
      updateIntegration(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};

export const useDeleteIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};

export const useSyncIntegration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncIntegration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};
