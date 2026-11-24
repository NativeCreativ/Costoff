import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  getCandidateInterviews,
  saveInterviewRound,
  type SaveInterviewRoundPayload,
  type InterviewManagerResponse,
} from '@/services/interviewManager.service';

export function useCandidateInterviewsQuery(requestId: string, dcId: string | null) {
  return useQuery<InterviewManagerResponse>({
    queryKey: queryKeys.candidateInterviewManager(requestId, dcId ?? ''),
    queryFn: () => getCandidateInterviews(requestId, dcId!),
    enabled: !!requestId && !!dcId,
    staleTime: 10 * 1000,
  });
}

export function useSaveInterviewRoundMutation(requestId: string, dcId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveInterviewRoundPayload) => saveInterviewRound(requestId, dcId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidateInterviewManager(requestId, dcId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidates(requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidateDetail(requestId, dcId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
    },
  });
}
