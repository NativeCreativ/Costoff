import { useQuery } from '@tanstack/react-query';
import { getCompanies, type CompanyFilters } from '@/services/company.service';
import type { PaginatedResult } from '@/lib/pagination';
import type { Company } from '@/components/types';

const STALE_TIME_MS = 30 * 1000;

/** Company list (Company module + the Demand form's Company dropdown). */
export function useCompaniesQuery(filters: CompanyFilters = {}) {
  return useQuery<PaginatedResult<Company>>({
    queryKey: ['companies', filters],
    queryFn: () => getCompanies(filters),
    staleTime: STALE_TIME_MS,
  });
}