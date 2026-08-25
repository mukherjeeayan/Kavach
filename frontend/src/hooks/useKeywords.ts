import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchKeywords,
  createKeyword,
  deleteKeyword,
} from '../services/api';

export const useKeywords = (category?: string, page = 1, limit = 50) =>
  useQuery({
    queryKey: ['keywords', category, page],
    queryFn: () => fetchKeywords(category, page, limit),
  });

export const useCreateKeyword = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createKeyword,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keywords'] }),
  });
};

export const useDeleteKeyword = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteKeyword,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keywords'] }),
  });
};
