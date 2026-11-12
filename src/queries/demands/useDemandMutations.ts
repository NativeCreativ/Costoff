import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { createDemand, updateDemand, deleteDemand } from '@/services/demand.service';
import { DemandFormState } from '@/components/demands/DemandFormModal';

export function useCreateDemandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ form, clonedFromDemandId }: { form: DemandFormState; clonedFromDemandId?: string }) =>
      createDemand(form, clonedFromDemandId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateDemandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: DemandFormState }) => updateDemand(id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteDemandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDemand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
