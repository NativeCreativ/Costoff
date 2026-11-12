import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  createSkillCategory,
  renameSkillCategory,
  deleteSkillCategory,
  reorderSkillCategories,
  createSkill,
  renameSkill,
  deleteSkill,
  reorderSkills,
  toggleSkillCategory,
  toggleSkill,
} from '@/services/skillsLibrary.service';

function useInvalidateSkillsLibrary() {
  const queryClient = useQueryClient();
  // Both keys: the picker's active-only list AND the settings screen's includeInactive
  // list (usage counts / menu badge).
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.skillsLibrary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.skillsLibraryIncludeInactive }),
  ]);
}

export function useCreateSkillCategoryMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) => createSkillCategory(input),
    onSuccess: invalidate,
  });
}

export function useRenameSkillCategoryMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string }) =>
      renameSkillCategory(id, { name, description }),
    onSuccess: invalidate,
  });
}

export function useDeleteSkillCategoryMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: (id: string) => deleteSkillCategory(id),
    onSuccess: invalidate,
  });
}

export function useReorderSkillCategoriesMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderSkillCategories(orderedIds),
    onSuccess: invalidate,
  });
}

export function useCreateSkillMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: ({ categoryId, name, skill_type, classification_id }: { categoryId: string; name: string; skill_type?: 'mandatory' | 'optional'; classification_id?: string | null }) =>
      createSkill(categoryId, name, { skill_type, classification_id }),
    onSuccess: invalidate,
  });
}

export function useRenameSkillMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: ({ id, name, skill_type, classification_id, category_id }: { id: string; name?: string; skill_type?: 'mandatory' | 'optional'; classification_id?: string | null; category_id?: string }) =>
      renameSkill(id, { name, skill_type, classification_id, category_id }),
    onSuccess: invalidate,
  });
}

export function useDeleteSkillMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: (id: string) => deleteSkill(id),
    onSuccess: invalidate,
  });
}

export function useReorderSkillsMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderSkills(orderedIds),
    onSuccess: invalidate,
  });
}

export function useToggleSkillCategoryMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleSkillCategory(id, isActive),
    onSuccess: invalidate,
  });
}

export function useToggleSkillMutation() {
  const invalidate = useInvalidateSkillsLibrary();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleSkill(id, isActive),
    onSuccess: invalidate,
  });
}
