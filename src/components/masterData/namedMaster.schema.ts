import { z } from 'zod';

export const namedMasterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Keep the name to 100 characters or fewer'),
});

export const namedMasterToggleSchema = z.object({
  is_active: z.boolean(),
});

export const namedMasterReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

/** PUT /api/demand-type-skill-groups — the complete set of Skill Groups for one Demand Type. */
export const demandTypeSkillGroupsSchema = z.object({
  demand_type_id: z.string().uuid(),
  skill_category_ids: z.array(z.string().uuid()).max(200),
});
