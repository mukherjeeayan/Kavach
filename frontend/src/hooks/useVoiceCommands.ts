import { useQuery } from '@tanstack/react-query';
import {
  fetchVoiceCommands,
} from '../services/api';

export const useVoiceCommands = (childId: string | null, page = 1, limit = 50) =>
  useQuery({
    queryKey: ['voiceCommands', childId, page, limit],
    queryFn: () => fetchVoiceCommands(childId as string, page, limit),
    enabled: !!childId,
  });
