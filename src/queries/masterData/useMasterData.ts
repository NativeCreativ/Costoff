'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  createNamedMaster,
  deleteNamedMaster,
  getNamedMaster,
  reorderNamedMaster,
  toggleNamedMaster,
  updateNamedMaster,
  getDemandTypeSkillGroups,
  setDemandTypeSkillGroups,
  type NamedMasterKind,
} from '@/services/masterData.service';
import { useToast } from '@/components/ui/Toast';

const STALE_TIME_MS = 60 * 1000;

export function useNamedMasterQuery(kind: NamedMasterKind) {
  return useQuery({
    queryKey: queryKeys.masterData(kind),
    queryFn: () => getNamedMaster(kind, false),
    staleTime: STALE_TIME_MS,
  });
}

export function useNamedMasterIncludeInactiveQuery(kind: NamedMasterKind) {
  return useQuery({
    queryKey: queryKeys.masterDataIncludeInactive(kind),
    queryFn: () => getNamedMaster(kind, true),
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}

function useInvalidateMaster(kind: NamedMasterKind) {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.masterData(kind) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.masterDataIncludeInactive(kind) }),
  ]);
}

export function useCreateNamedMasterMutation(kind: NamedMasterKind) {
  const invalidate = useInvalidateMaster(kind);
  return useMutation({ mutationFn: (name: string) => createNamedMaster(kind, name), onSuccess: invalidate });
}

export function useUpdateNamedMasterMutation(kind: NamedMasterKind) {
  const invalidate = useInvalidateMaster(kind);
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateNamedMaster(kind, id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteNamedMasterMutation(kind: NamedMasterKind) {
  const invalidate = useInvalidateMaster(kind);
  return useMutation({ mutationFn: (id: string) => deleteNamedMaster(kind, id), onSuccess: invalidate });
}

export function useToggleNamedMasterMutation(kind: NamedMasterKind) {
  const invalidate = useInvalidateMaster(kind);
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleNamedMaster(kind, id, isActive),
    onSuccess: invalidate,
  });
}

export function useReorderNamedMasterMutation(kind: NamedMasterKind) {
  const invalidate = useInvalidateMaster(kind);
  return useMutation({ mutationFn: (orderedIds: string[]) => reorderNamedMaster(kind, orderedIds), onSuccess: invalidate });
}

export function useDemandTypeSkillGroupsQuery() {
  return useQuery({
    queryKey: queryKeys.demandTypeSkillGroups,
    queryFn: getDemandTypeSkillGroups,
    staleTime: STALE_TIME_MS,
  });
}

export function useSetDemandTypeSkillGroupsMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ demandTypeId, skillCategoryIds }: { demandTypeId: string; skillCategoryIds: string[] }) =>
      setDemandTypeSkillGroups(demandTypeId, skillCategoryIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.demandTypeSkillGroups }),
    onError: (err: any) => {
      console.error('Error saving demand type skill groups:', err);
      toast.error('Save Failed', err?.response?.data?.error || err?.message || 'Failed to save the skill groups');
    },
  });
}
