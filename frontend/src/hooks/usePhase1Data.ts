import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContact,
  createLock,
  deleteContact,
  deleteLock,
  fetchChildAlerts,
  fetchContacts,
  fetchCurrentLocations,
  fetchDailyScreenTime,
  fetchLocks,
  fetchLocationHistory,
  fetchScreenTimeSummary,
  setParentPin,
  setScreenTimeLimit,
  updateContact,
  updateLock,
  verifyParentPin,
} from '../services/api';
import type { ContactInput, LockInput } from '../types/api';

export const useLocks = (childId: string | null) =>
  useQuery({
    queryKey: ['locks', childId],
    queryFn: () => fetchLocks(childId as string),
    enabled: !!childId,
  });

export const useContacts = (childId: string | null) =>
  useQuery({
    queryKey: ['contacts', childId],
    queryFn: () => fetchContacts(childId as string),
    enabled: !!childId,
  });

export const useScreenTimeSummary = (childId: string | null, range: 'day' | 'week' | 'month') =>
  useQuery({
    queryKey: ['screenTimeSummary', childId, range],
    queryFn: () => fetchScreenTimeSummary(childId as string, range),
    enabled: !!childId,
  });

export const useDailyScreenTime = (childId: string | null, date: string) =>
  useQuery({
    queryKey: ['screenTimeDaily', childId, date],
    queryFn: () => fetchDailyScreenTime(childId as string, date),
    enabled: !!childId,
  });

export const useChildAlerts = (childId: string | null) =>
  useQuery({
    queryKey: ['childAlerts', childId],
    queryFn: () => fetchChildAlerts(childId as string),
    enabled: !!childId,
    refetchInterval: 5 * 60 * 1000,
  });

/** Sets or clears the daily screen-time limit, then refreshes children. */
export const useScreenTimeLimitAction = (childId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (limitMinutes: number | null) =>
      setScreenTimeLimit(childId as string, limitMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
};

export const useCurrentLocations = (childId: string | null) =>
  useQuery({
    queryKey: ['locationsCurrent', childId],
    queryFn: () => fetchCurrentLocations(childId as string),
    enabled: !!childId,
    refetchInterval: 5 * 60 * 1000,
  });

export const useLocationHistory = (childId: string | null) =>
  useQuery({
    queryKey: ['locationsHistory', childId],
    queryFn: () => fetchLocationHistory(childId as string),
    enabled: !!childId,
  });

export const useLockActions = (childId: string | null) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['locks', childId] });

  return {
    create: useMutation({
      mutationFn: (input: LockInput) => createLock(childId as string, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ lockId, input }: { lockId: string; input: LockInput }) =>
        updateLock(childId as string, lockId, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (lockId: string) => deleteLock(childId as string, lockId),
      onSuccess: invalidate,
    }),
  };
};

export const useContactActions = (childId: string | null) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contacts', childId] });

  return {
    create: useMutation({
      mutationFn: (input: ContactInput) => createContact(childId as string, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ contactId, input }: { contactId: string; input: ContactInput }) =>
        updateContact(childId as string, contactId, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (contactId: string) => deleteContact(childId as string, contactId),
      onSuccess: invalidate,
    }),
  };
};

/** Surfaces the first mutation error (or clears it) to the dashboard error area. */
export const useActionsError = (
  mutations: Array<{ isError: boolean; error: unknown }>,
  onError: (message: string | null) => void
) => {
  const errorKey = mutations.map((m) => m.isError).join(',');
  useEffect(() => {
    const failed = mutations.find((m) => m.isError);
    if (failed) {
      onError(failed.error instanceof Error ? failed.error.message : 'Action failed');
    } else {
      onError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorKey, onError]);
};

/** Verifies the parent PIN (set on the child device) against the backend. */
export const useVerifyParentPin = () =>
  useMutation({
    mutationFn: ({ email, pin }: { email: string; pin: string }) =>
      verifyParentPin(email, pin),
  });

/** Sets or rotates the parent PIN from the dashboard (authenticated). */
export const useSetParentPin = () =>
  useMutation({
    mutationFn: (pin: string) => setParentPin(pin),
  });