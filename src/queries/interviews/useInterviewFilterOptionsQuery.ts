import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getInterviewFilterOptions } from '@/services/interview.service';

const STALE_TIME_MS = 60 * 1000;

export function useInterviewFilterOptionsQuery(type: string, search: string = '') {
  return useQuery({
    queryKey: queryKeys.interviewFilterOptions(type, search),
    queryFn: () => getInterviewFilterOptions(type, search),
    staleTime: STALE_TIME_MS,
    placeholderData: (prev) => prev,
  });
}
