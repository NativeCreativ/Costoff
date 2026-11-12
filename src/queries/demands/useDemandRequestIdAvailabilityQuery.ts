'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { checkDemandRequestIdAvailable } from '@/services/demand.service';
import { validateDemandRequestId } from '@/lib/demands/demandRequestIdRules';

interface DemandRequestIdAvailabilityOptions {
  /** Edit mode passes the demand's own id, so its unchanged ID never reports itself taken. */
  excludeId?: string;
  enabled?: boolean;
}

// Only a value that is already valid on its own terms is worth a request: blank means
// "auto-generate" and a malformed one is already reported by the form. A hint for the user,
// never the boundary - POST /api/demands re-checks and answers 409.
export function useDemandRequestIdAvailabilityQuery(requestId: string, options?: DemandRequestIdAvailabilityOptions) {
  const validation = validateDemandRequestId(requestId);
  const value = validation.ok ? validation.value : '';
  const enabled = (options?.enabled ?? true) && value !== '';

  return useQuery({
    queryKey: queryKeys.demandRequestIdCheck(value, options?.excludeId),
    queryFn: () => checkDemandRequestIdAvailable(value, options?.excludeId),
    enabled,
    staleTime: 15 * 1000,
    retry: false,
  });
}