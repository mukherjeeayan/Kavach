import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchRewardCatalog,
  createRewardItem,
  fetchRewardPoints,
  awardPoints,
  fetchRedemptions,
  redeemReward,
} from '../services/api';

export const useRewardCatalog = () =>
  useQuery({
    queryKey: ['rewardCatalog'],
    queryFn: fetchRewardCatalog,
  });

export const useCreateRewardItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRewardItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewardCatalog'] }),
  });
};

export const useRewardPoints = (childId: string | null) =>
  useQuery({
    queryKey: ['rewardPoints', childId],
    queryFn: () => fetchRewardPoints(childId as string),
    enabled: !!childId,
  });

export const useAwardPoints = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { points: number; reason: string; source?: string }) =>
      awardPoints(childId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewardPoints', childId] }),
  });
};

export const useRedemptions = (childId: string | null) =>
  useQuery({
    queryKey: ['redemptions', childId],
    queryFn: () => fetchRedemptions(childId as string),
    enabled: !!childId,
  });

export const useRedeemReward = (childId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(childId as string, rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['redemptions', childId] });
      qc.invalidateQueries({ queryKey: ['rewardPoints', childId] });
    },
  });
};
