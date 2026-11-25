'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import {
  createSkillGroup,
  deleteSkillGroup,
  getAdminSkillGroups,
  getSkillGroups,
  setSkillCategoryGroup,
  updateSkillGroup,
} from '@/services/skillsLibrary.service';

/** Active Skill Groups for the skills picker. */
export function useSkillGroupsQuery() {
  return useQuery({ queryKey: queryKeys.skillGroups, queryFn: getSkillGroups, staleTime: 60 * 1000 });
}

/** Every Skill Group, for Master Data. */
export function useAdminSkillGroupsQuery() {
  return useQuery({ queryKey: queryKeys.skillGroupsAdmin, queryFn: getAdminSkillGroups, refetchOnMount: 'always' });
}

function useInvalidateSkills() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['skill-groups'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.skillsLibrary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.skillsLibraryIncludeInactive }),
    ]);
}

export function useSkillGroupMutations() {
  const invalidate = useInvalidateSkills();
  const toast = useToast();
  const onError = (err: any) => toast.error('Save failed', err?.response?.data?.error || err?.message || 'Please try again');
  return {
    create: useMutation({ mutationFn: createSkillGroup, onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string; name: string; description?: string; is_active?: boolean }) => updateSkillGroup(id, input),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteSkillGroup, onSuccess: invalidate, onError }),
    setCategoryGroup: useMutation({
      mutationFn: ({ category, groupId }: { category: { id: string; name: string; description?: string | null }; groupId: string | null }) =>
        setSkillCategoryGroup(category, groupId),
      onSuccess: invalidate,
      onError,
    }),
  };
}
