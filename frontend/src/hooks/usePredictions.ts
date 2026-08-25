import { useQuery } from '@tanstack/react-query';
import { fetchBehaviorPredictions, fetchSecurityScans, fetchWifiLogs } from '../services/api';

export const useBehaviorPredictions = (childId: string | null) =>
  useQuery({
    queryKey: ['predictions', childId],
    queryFn: () => fetchBehaviorPredictions(childId as string),
    enabled: !!childId,
  });

export const useSecurityScans = (childId: string | null, deviceId: string | null) =>
  useQuery({
    queryKey: ['securityScans', childId, deviceId],
    queryFn: () => fetchSecurityScans(childId as string, deviceId as string),
    enabled: !!childId && !!deviceId,
  });

export const useWifiLogs = (childId: string | null, deviceId: string | null) =>
  useQuery({
    queryKey: ['wifiLogs', childId, deviceId],
    queryFn: () => fetchWifiLogs(childId as string, deviceId as string),
    enabled: !!childId && !!deviceId,
  });
