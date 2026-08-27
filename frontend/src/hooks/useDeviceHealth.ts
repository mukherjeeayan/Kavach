import { useQuery } from '@tanstack/react-query';
import { fetchDeviceHealth, fetchDeviceHealthHistory } from '../services/api';

export const useDeviceHealth = (childId: string | null, deviceId: string | null) =>
  useQuery({
    queryKey: ['deviceHealth', childId, deviceId],
    queryFn: () => fetchDeviceHealth(childId ?? '', deviceId ?? ''),
    enabled: !!childId && !!deviceId,
  });

export const useDeviceHealthHistory = (
  childId: string | null,
  deviceId: string | null,
  limit = 48
) =>
  useQuery({
    queryKey: ['deviceHealthHistory', childId, deviceId, limit],
    queryFn: () => fetchDeviceHealthHistory(childId ?? '', deviceId ?? '', limit),
    enabled: !!childId && !!deviceId,
  });