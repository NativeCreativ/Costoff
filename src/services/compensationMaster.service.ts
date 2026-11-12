import { api } from '@/lib/axios';
import { CompensationCurrency, CompensationType } from '@/components/types';

export interface CompensationCurrencyPayload {
  code: string;
  name: string;
  symbol: string;
}

export async function getCompensationCurrencies(includeInactive = false): Promise<CompensationCurrency[]> {
  const { data } = await api.get(`/admin/settings/compensation-currencies${includeInactive ? '?includeInactive=true' : ''}`);
  return data.currencies || [];
}

export async function createCompensationCurrency(payload: CompensationCurrencyPayload): Promise<CompensationCurrency> {
  const { data } = await api.post('/admin/settings/compensation-currencies', payload);
  return data.currency;
}

export async function updateCompensationCurrency(id: string, payload: CompensationCurrencyPayload): Promise<CompensationCurrency> {
  const { data } = await api.put(`/admin/settings/compensation-currencies/${id}`, payload);
  return data.currency;
}

export async function deleteCompensationCurrency(id: string): Promise<void> {
  await api.delete(`/admin/settings/compensation-currencies/${id}`);
}

export async function reorderCompensationCurrencies(orderedIds: string[]): Promise<CompensationCurrency[]> {
  const { data } = await api.put('/admin/settings/compensation-currencies/reorder', { orderedIds });
  return data.currencies || [];
}

export interface CompensationTypePayload {
  name: string;
}

export async function getCompensationTypes(includeInactive = false): Promise<CompensationType[]> {
  const { data } = await api.get(`/admin/settings/compensation-types${includeInactive ? '?includeInactive=true' : ''}`);
  return data.types || [];
}

export async function createCompensationType(payload: CompensationTypePayload): Promise<CompensationType> {
  const { data } = await api.post('/admin/settings/compensation-types', payload);
  return data.type;
}

export async function updateCompensationType(id: string, payload: CompensationTypePayload): Promise<CompensationType> {
  const { data } = await api.put(`/admin/settings/compensation-types/${id}`, payload);
  return data.type;
}

export async function deleteCompensationType(id: string): Promise<void> {
  await api.delete(`/admin/settings/compensation-types/${id}`);
}

export async function reorderCompensationTypes(orderedIds: string[]): Promise<CompensationType[]> {
  const { data } = await api.put('/admin/settings/compensation-types/reorder', { orderedIds });
  return data.types || [];
}

export async function toggleCompensationCurrency(id: string, isActive: boolean): Promise<CompensationCurrency> {
  const { data } = await api.put(`/admin/settings/compensation-currencies/${id}/toggle`, { is_active: isActive });
  return data.currency;
}

export async function toggleCompensationType(id: string, isActive: boolean): Promise<CompensationType> {
  const { data } = await api.put(`/admin/settings/compensation-types/${id}/toggle`, { is_active: isActive });
  return data.type;
}
