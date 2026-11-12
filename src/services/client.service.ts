import { api } from '@/lib/axios';
import { ClientAccount } from '@/components/types';
import { ClientFormState } from '@/components/crm/ClientFormModal';

export async function getClients(): Promise<ClientAccount[]> {
  const { data } = await api.get('/clients');
  return data.clients || [];
}

export async function createClient(form: ClientFormState): Promise<ClientAccount> {
  const { data } = await api.post('/clients', form);
  return data.client;
}
