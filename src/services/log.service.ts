import { api } from '@/lib/axios';
import { ActivityLog } from '@/components/types';

export async function getLogs(): Promise<ActivityLog[]> {
  const { data } = await api.get('/logs');
  return data.logs || [];
}
