import { api } from '@/lib/axios';
import { SkillCategory, Skill } from '@/components/types';

export async function getSkillsLibrary(): Promise<SkillCategory[]> {
  const { data } = await api.get('/skills-library');
  return data.categories || [];
}

/** GET /api/admin/settings/skill-categories?includeInactive=true — the settings screen's own
 *  list, inactive rows included (shown muted there). */
export async function getAdminSkillsLibrary(): Promise<SkillCategory[]> {
  const { data } = await api.get('/admin/settings/skill-categories?includeInactive=true');
  return data.categories || [];
}

export async function createSkillCategory(input: { name: string; description?: string }): Promise<SkillCategory> {
  const { data } = await api.post('/admin/settings/skill-categories', input);
  return data.category;
}

export async function renameSkillCategory(id: string, input: { name: string; description?: string }): Promise<SkillCategory> {
  const { data } = await api.put(`/admin/settings/skill-categories/${id}`, input);
  return data.category;
}

export async function deleteSkillCategory(id: string): Promise<void> {
  await api.delete(`/admin/settings/skill-categories/${id}`);
}

export async function reorderSkillCategories(orderedIds: string[]): Promise<SkillCategory[]> {
  const { data } = await api.put('/admin/settings/skill-categories/reorder', { orderedIds });
  return data.categories || [];
}

export async function createSkill(
  categoryId: string,
  name: string,
  extra?: { skill_type?: 'mandatory' | 'optional'; classification_id?: string | null }
): Promise<Skill> {
  const { data } = await api.post('/admin/settings/skills', {
    category_id: categoryId,
    name,
    skill_type: extra?.skill_type,
    classification_id: extra?.classification_id || null,
  });
  return data.skill;
}

export async function renameSkill(
  id: string,
  input: { name?: string; skill_type?: 'mandatory' | 'optional'; classification_id?: string | null; category_id?: string }
): Promise<Skill> {
  const { data } = await api.put(`/admin/settings/skills/${id}`, input);
  return data.skill;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/admin/settings/skills/${id}`);
}

export async function reorderSkills(orderedIds: string[]): Promise<Skill[]> {
  const { data } = await api.put('/admin/settings/skills/reorder', { orderedIds });
  return data.skills || [];
}

export async function toggleSkillCategory(id: string, isActive: boolean): Promise<void> {
  await api.put(`/admin/settings/skill-categories/${id}/toggle`, { is_active: isActive });
}

export async function toggleSkill(id: string, isActive: boolean): Promise<void> {
  await api.put(`/admin/settings/skills/${id}/toggle`, { is_active: isActive });
}
