import { z } from 'zod';
import { SKILL_MAX_LENGTH } from '@/lib/skills';

export const skillCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(SKILL_MAX_LENGTH, `Keep it to ${SKILL_MAX_LENGTH} characters or fewer`),
  description: z.string().trim().max(500, 'Keep the description to 500 characters or fewer').optional().or(z.literal('')),
});
export type SkillCategoryValues = z.infer<typeof skillCategorySchema>;

export const SKILL_TYPE_VALUES = ['mandatory', 'optional'] as const;

export const skillSchema = z.object({
  category_id: z.string().uuid('Select a skill group'),
  name: z.string().trim().min(1, 'Name is required').max(SKILL_MAX_LENGTH, `Keep it to ${SKILL_MAX_LENGTH} characters or fewer`),
  skill_type: z.enum(SKILL_TYPE_VALUES).optional(),
  classification_id: z.string().uuid().nullable().optional().or(z.literal('')),
});
export type SkillValues = z.infer<typeof skillSchema>;

export const skillRenameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(SKILL_MAX_LENGTH, `Keep it to ${SKILL_MAX_LENGTH} characters or fewer`).optional(),
  skill_type: z.enum(SKILL_TYPE_VALUES).optional(),
  classification_id: z.string().uuid().nullable().optional().or(z.literal('')),
  category_id: z.string().uuid().optional(),
});
export type SkillRenameValues = z.infer<typeof skillRenameSchema>;

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, 'orderedIds is required'),
});
export type ReorderValues = z.infer<typeof reorderSchema>;
