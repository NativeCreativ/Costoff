'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import { addCandidateConversation, getCandidateConversations } from '@/services/candidate.service';

export function useCandidateConversationsQuery(candidateId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.candidateConversations(candidateId ?? ''),
    queryFn: () => getCandidateConversations(candidateId as string),
    enabled: !!candidateId,
    staleTime: 15 * 1000,
  });
}

export function useAddCandidateConversationMutation(candidateId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: { channel: string; content: string; demand_id?: string | null }) => addCandidateConversation(candidateId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.candidateConversations(candidateId) }),
    onError: (err: any) => {
      console.error('Error saving conversation:', err);
      toast.error('Save Failed', err?.response?.data?.error || err?.message || 'Failed to save the conversation');
    },
  });
}
