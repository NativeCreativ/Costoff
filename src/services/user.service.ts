import { api } from '@/lib/axios';
import { Profile } from '@/components/types';
import { UserFormState } from '@/components/users/UserFormModal';
import { PaginatedResult } from '@/lib/pagination';

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getUsers(filters: UserFilters = {}): Promise<PaginatedResult<Profile>> {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.role) params.role = filters.role;
  if (filters.status) params.status = filters.status;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;

  const { data } = await api.get('/users', { params });
  return {
    data: data.profiles || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

export async function createUser(form: UserFormState): Promise<Profile> {
  const { data } = await api.post('/users', form);
  return data.profile;
}

export async function updateUser(id: string, form: UserFormState): Promise<Profile> {
  const { data } = await api.put('/users', { id, ...form });
  return data.profile;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete('/users', { params: { id } });
}

export async function changeUserPassword(
  id: string,
  newPassword: string,
  confirmPassword: string,
  oldPassword?: string
): Promise<void> {
  await api.put(`/users/${id}/password`, { newPassword, confirmPassword, ...(oldPassword ? { oldPassword } : {}) });
}

export async function setUserAccess(id: string, blockedModules: string[]): Promise<Profile> {
  const { data } = await api.put(`/users/${id}/access`, { blocked_modules: blockedModules });
  return data.profile;
}
