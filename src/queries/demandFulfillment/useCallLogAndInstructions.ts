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
