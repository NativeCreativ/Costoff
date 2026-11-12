import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getDemands, DemandFilters } from '@/services/demand.service';

const STALE_TIME_MS = 30 * 1000;

export function useDemandsQuery(filters: DemandFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.demands(filters),
    queryFn: () => getDemands(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
    enabled: options?.enabled,
  });
}
