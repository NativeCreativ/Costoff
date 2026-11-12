import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getPerformance } from '@/services/performance.service';

export function usePerformanceQuery() {
  return useQuery({
    queryKey: queryKeys.performance,
    queryFn: getPerformance,
  });
}
