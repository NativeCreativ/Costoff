'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { createEndClient, getEndClients, updateEndClient } from '@/services/endClient.service';
import type { EndClientFormValues } from '@/components/masterData/endClient.schema';

export function useEndClientsQuery(filters: { search?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: queryKeys.endClients(filters),
    queryFn: () => getEndClients(filters),
  });
}

export function useActiveEndClientsQuery() {
  return useQuery({
    queryKey: queryKeys.endClientsActive,
    queryFn: () => getEndClients({ active: true }),
    staleTime: 60 * 1000,
  });
}

function useInvalidateEndClients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['end-clients'] });
}

export function useCreateEndClientMutation() {
  const invalidate = useInvalidateEndClients();
  return useMutation({ mutationFn: (form: EndClientFormValues) => createEndClient(form), onSuccess: invalidate });
}

export function useUpdateEndClientMutation() {
  const invalidate = useInvalidateEndClients();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: EndClientFormValues }) => updateEndClient(id, form),
    onSuccess: invalidate,
  });
}
