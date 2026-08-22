import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createChild,
  fetchBlockedApps,
  fetchChildDevices,
  fetchChildren,
  fetchUnblockRequests,
  setAppDailyLimit,
} from '../services/api';

export const useChildren = () =>
  useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
  });

export const useCreateChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, birthDate }: { name: string; birthDate?: string }) =>
      createChild(name, birthDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
};

export const useDevices = (childId: string | null) =>
  useQuery({
    queryKey: ['devices', childId],
    queryFn: () => fetchChildDevices(childId as string),
    enabled: !!childId,
  });

export const useBlockedApps = (childId: string | null, refetchInterval?: number | false) =>
  useQuery({
    queryKey: ['blocked', childId],
    queryFn: () => fetchBlockedApps(childId as string),
    enabled: !!childId,
    refetchInterval,
  });

export const useUnblockRequests = (
  childId: string | null,
  refetchInterval?: number | false
) =>
  useQuery({
    queryKey: ['unblockRequests', childId],
    queryFn: () => fetchUnblockRequests(childId as string),
    enabled: !!childId,
    refetchInterval,
  });

/** Returns a callback that refreshes the two child-scoped queries. */
export const useInvalidateChildData = (childId: string | null) => {
  const queryClient = useQueryClient();
  return () => {
    if (childId) {
      queryClient.invalidateQueries({ queryKey: ['blocked', childId] });
      queryClient.invalidateQueries({ queryKey: ['unblockRequests', childId] });
    }
  };
};

/** Sets or clears a per-app daily usage cap, then refreshes the rules. */
export const useSetAppDailyLimit = (childId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      dailyLimitMinutes,
    }: {
      ruleId: string;
      dailyLimitMinutes: number | null;
    }) => setAppDailyLimit(childId as string, ruleId, dailyLimitMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked', childId] });
    },
  });
};
