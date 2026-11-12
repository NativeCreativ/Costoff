import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getInterviews, InterviewFilters } from '@/services/interview.service';

const STALE_TIME_MS = 30 * 1000;

export function useInterviewsQuery(filters: InterviewFilters) {
  return useQuery({
    queryKey: queryKeys.interviews(filters),
    queryFn: () => getInterviews(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}
