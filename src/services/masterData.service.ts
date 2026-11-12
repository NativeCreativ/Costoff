import { api } from '@/lib/axios';

export type NamedMasterKind =
  | 'demand-categories'
  | 'demand-phases'
  | 'locations'
  | 'demand-types'
  | 'interview-statuses'
  | 'skill-classifications';

export interface NamedMasterItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_transition?: boolean;
  requires_result?: boolean;
  usage?: { records: number };
}

export async function getNamedMaster(kind: NamedMasterKind, includeInactive = false): Promise<NamedMasterItem[]> {
  const { data } = await api.get(`/master-data/${kind}`, {
    params: includeInactive ? { includeInactive: 'true' } : undefined,
  });
  return data.items || [];
}

export async function createNamedMaster(kind: NamedMasterKind, name: string): Promise<NamedMasterItem> {
  const { data } = await api.post(`/master-data/${kind}`, { name });
  return data.item;
}

export async function updateNamedMaster(kind: NamedMasterKind, id: string, name: string): Promise<NamedMasterItem> {
  const { data } = await api.put(`/master-data/${kind}/${id}`, { name });
  return data.item;
}

export async function deleteNamedMaster(kind: NamedMasterKind, id: string): Promise<void> {
  await api.delete(`/master-data/${kind}/${id}`);
}

export async function toggleNamedMaster(kind: NamedMasterKind, id: string, isActive: boolean): Promise<void> {
  await api.put(`/master-data/${kind}/${id}/toggle`, { is_active: isActive });
}

export async function reorderNamedMaster(kind: NamedMasterKind, orderedIds: string[]): Promise<void> {
  await api.put(`/master-data/${kind}/reorder`, { orderedIds });
}

export interface DemandTypeSkillGroupLink {
  demand_type_id: string;
  demand_type_name: string;
  skill_category_ids: string[];
}

/** Every Demand Type's linked Skill Group ids. Types with no links are simply absent. */
export async function getDemandTypeSkillGroups(): Promise<DemandTypeSkillGroupLink[]> {
  const { data } = await api.get('/demand-type-skill-groups');
  return data.links ?? [];
}

/** Replaces one Demand Type's Skill Groups. */
export async function setDemandTypeSkillGroups(demandTypeId: string, skillCategoryIds: string[]): Promise<void> {
  await api.put('/demand-type-skill-groups', { demand_type_id: demandTypeId, skill_category_ids: skillCategoryIds });
}
