import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  createInterview,
  updateInterviewStatus,
  updateInterview,
  deleteInterview,
  bulkChangeInterviewStatus,
  bulkDeleteInterviews,
} from '@/services/interview.service';
import { InterviewFormState } from '@/components/interviews/InterviewFormModal';

export function useCreateInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: InterviewFormState) => createInterview(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateInterviewStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateInterviewStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: Partial<InterviewFormState> }) => updateInterview(id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInterview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useBulkChangeInterviewStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ interviewIds, status, result }: { interviewIds: string[]; status: string; result?: string }) => bulkChangeInterviewStatus(interviewIds, status, result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useBulkDeleteInterviewsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewIds: string[]) => bulkDeleteInterviews(interviewIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
