import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings } from '../services/api';
import type { UserSettingsInput } from '../types/api';

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserSettingsInput) => updateSettings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
};
