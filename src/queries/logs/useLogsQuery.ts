import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getLogs } from '@/services/log.service';

export function useLogsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.logs,
    queryFn: getLogs,
    enabled,
  });
}
