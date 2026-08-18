import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBlockedApps,
  fetchChildDevices,
  fetchChildren,
  fetchUnblockRequests,
} from '../services/api';

export const useChildren = () =>
  useQuery({
    queryKey: ['children'],
    queryFn: fetchChildren,
  });

export const useDevices = (childId: string | null) =>
  useQuery({
    queryKey: ['devices', childId],
    queryFn: () => fetchChildDevices(childId as string),
    enabled: !!childId,
  });

export const useBlockedApps = (childId: string | null) =>
  useQuery({
    queryKey: ['blocked', childId],
    queryFn: () => fetchBlockedApps(childId as string),
    enabled: !!childId,
  });

export const useUnblockRequests = (childId: string | null) =>
  useQuery({
    queryKey: ['unblockRequests', childId],
    queryFn: () => fetchUnblockRequests(childId as string),
    enabled: !!childId,
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
