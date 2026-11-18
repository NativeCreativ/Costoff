'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import {
  deleteDemandInstruction,
  getDemandCallLogs,
  getDemandInstructions,
  logDemandCall,
  saveDemandInstruction,
  updateDemandCall,
  addCallCandidateToSourcing,
} from '@/services/demandFulfillment.service';

export function useDemandCallLogsQuery(requestId: string) {
  return useQuery({
    queryKey: queryKeys.demandCallLogs(requestId),
    queryFn: () => getDemandCallLogs(requestId),
    enabled: !!requestId,
    staleTime: 15 * 1000,
  });
}

/** A "fit" call changes the pipeline, so the demand's lifecycle / candidates / log refresh too. */
export function useLogDemandCallMutation(requestId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: unknown) => logDemandCall(requestId, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['demands', requestId] }),
        queryClient.invalidateQueries({ queryKey: ['candidates'] }),
      ]),
    onError: (err: any) => {
      console.error('Error logging call:', err);
      toast.error('Log Failed', err?.response?.data?.error || err?.message || 'Failed to log the call');
    },
  });
}

/** Edit a logged call. */
export function useUpdateDemandCallMutation(requestId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ callId, payload }: { callId: string; payload: unknown }) => updateDemandCall(requestId, callId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.demandCallLogs(requestId) }),
    onError: (err: any) => toast.error('Update Failed', err?.response?.data?.error || err?.message || 'Failed to update the call'),
  });
}

/** Demand Match follow-up: the call's candidate goes into Sourcing. Refreshes the pipeline. */
export function useAddCallToSourcingMutation(requestId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (callId: string) => addCallCandidateToSourcing(requestId, callId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['demands', requestId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) }),
      ]),
    onError: (err: any) => toast.error('Could not add to Sourcing', err?.response?.data?.error || err?.message || 'Failed'),
  });
}

export function useDemandInstructionsQuery(requestId: string) {
  return useQuery({
    queryKey: queryKeys.demandInstructions(requestId),
    queryFn: () => getDemandInstructions(requestId),
    enabled: !!requestId,
    staleTime: 15 * 1000,
  });
}

export function useSaveDemandInstructionMutation(requestId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: { source: string; instruction_date: string; content: string } }) =>
      saveDemandInstruction(requestId, id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.demandInstructions(requestId) }),
    onError: (err: any) => {
      console.error('Error saving instruction:', err);
      toast.error('Save Failed', err?.response?.data?.error || err?.message || 'Failed to save the instruction');
    },
  });
}

export function useDeleteDemandInstructionMutation(requestId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteDemandInstruction(requestId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.demandInstructions(requestId) }),
    onError: (err: any) => {
      console.error('Error deleting instruction:', err);
      toast.error('Delete Failed', err?.response?.data?.error || err?.message || 'Failed to delete the instruction');
    },
  });
}
