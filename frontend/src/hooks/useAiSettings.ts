import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAiSettings,
  fetchAiModels,
  fetchAiSettings,
  saveAiSettings,
  testAiConnection,
  type AiSettings,
  type ModelInfo,
} from '../services/api';

export const useAiSettings = () =>
  useQuery({
    queryKey: ['aiSettings'],
    queryFn: fetchAiSettings,
  });

export const useSaveAiSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider: AiSettings['provider']; api_key: string; model: string }) =>
      saveAiSettings(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
};

export const useTestAiConnection = () =>
  useMutation({
    mutationFn: (provider: AiSettings['provider']) => testAiConnection(provider),
  });

export const useDeleteAiSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiSettings['provider']) => deleteAiSettings(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
};

export const useFetchModels = () =>
  useMutation<ModelInfo[], Error, { provider: AiSettings['provider']; apiKey: string }>({
    mutationFn: ({ provider, apiKey }) => fetchAiModels(provider, apiKey),
  });