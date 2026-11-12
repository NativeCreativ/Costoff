import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getCandidates, CandidateFilters } from '@/services/candidate.service';

const STALE_TIME_MS = 30 * 1000;

export function useCandidatesQuery(filters: CandidateFilters) {
  return useQuery({
    queryKey: queryKeys.candidates(filters),
    queryFn: () => getCandidates(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}
