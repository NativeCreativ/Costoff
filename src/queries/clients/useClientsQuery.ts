import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getClients } from '@/services/client.service';

export function useClientsQuery() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: getClients,
  });
}
