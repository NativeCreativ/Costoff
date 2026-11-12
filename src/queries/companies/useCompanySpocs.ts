'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCompanySpoc, getCompanySpocs } from '@/services/company.service';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import type { ClientSpocItem } from '@/components/masterData/spoc.schema';

/** The selected client's SPOCs on the demand form. Disabled until a client is picked. */
export function useCompanySpocsQuery(companyId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.companySpocs(companyId ?? ''),
    queryFn: () => getCompanySpocs(companyId as string),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useAddCompanySpocMutation(companyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (spoc: ClientSpocItem) => addCompanySpoc(companyId as string, spoc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: any) => {
      console.error('Error adding client SPOC:', err);
      toast.error('Add SPOC Failed', err?.response?.data?.error || err?.message || 'Failed to add the SPOC');
    },
  });
}
