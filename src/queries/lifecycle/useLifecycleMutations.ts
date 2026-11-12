import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchAssignCandidates, updateSubmissionStage } from '@/services/lifecycle.service';

export function useBatchAssignCandidatesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, candidateIds }: { demandId: string; candidateIds: string[] }) =>
      batchAssignCandidates(demandId, candidateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}

export function useUpdateSubmissionStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, stage }: { submissionId: string; stage: string }) =>
      updateSubmissionStage(submissionId, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}
