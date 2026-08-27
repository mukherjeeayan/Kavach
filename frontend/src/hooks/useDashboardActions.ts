import { useMutation } from '@tanstack/react-query';
import { blockApp as blockAppApi, respondToUnblockRequest } from '../services/api';
import type { BlockAppInput } from '../services/api';
import { getErrorMessage } from '../utils/apiError';

export const useBlockAppAction = (
  childId: string | null,
  onSuccess: () => void,
  onError: (message: string) => void
) =>
  useMutation({
    mutationFn: (input: BlockAppInput) => blockAppApi(childId ?? '', input),
    onSuccess,
    onError: (error) => onError(getErrorMessage(error, 'Failed to block app')),
  });

export const useRespondToUnblockRequest = (
  childId: string | null,
  onSuccess: () => void,
  onError: (message: string) => void
) =>
  useMutation({
    mutationFn: ({ ruleId, decision }: { ruleId: string; decision: 'approve' | 'reject' }) =>
      respondToUnblockRequest(childId ?? '', ruleId, decision),
    onSuccess,
    onError: (error) =>
      onError(getErrorMessage(error, 'Failed to update the unblock request. Please retry.')),
  });