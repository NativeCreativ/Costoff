import { api } from '@/lib/axios';
import { SlaConfig } from '@/components/types';

export async function getSettings(): Promise<{ slaConfig: SlaConfig }> {
  const { data } = await api.get('/settings');
  return { slaConfig: data.slaConfig };
}

/** dropdown_masters rows for a given category (e.g. 'time_zone'), sorted by sort_order. */
export async function getDropdownOptions(category: string): Promise<string[]> {
  const { data } = await api.get('/settings', { params: { category } });
  return (data.dropdowns || []).map((d: { value: string }) => d.value);
}
