import { api } from '@/lib/axios';
import type { EndClientFormValues } from '@/components/masterData/endClient.schema';
import type { ClientSpoc } from '@/components/types';
import type { PaginatedResult } from '@/lib/pagination';

export interface EndClient {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  status: string;
  end_client_spocs?: ClientSpoc[];
  _count?: { demands: number };
}

export async function getEndClients(filters: { search?: string; status?: string; page?: number; pageSize?: number; active?: boolean } = {}): Promise<PaginatedResult<EndClient>> {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  if (filters.active) params.active = 'true';
  const { data } = await api.get('/end-clients', { params });
  return {
    data: data.endClients || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

export async function createEndClient(form: EndClientFormValues): Promise<EndClient> {
  const { data } = await api.post('/end-clients', form);
  return data.endClient;
}

export async function updateEndClient(id: string, form: EndClientFormValues): Promise<EndClient> {
  const { data } = await api.put(`/end-clients/${id}`, form);
  return data.endClient;
}
