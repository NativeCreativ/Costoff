import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getRequirementLifecycle } from '@/services/lifecycle.service';

export function useLifecycleQuery(requestId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.lifecycle(requestId || ''),
    queryFn: () => getRequirementLifecycle(requestId as string),
    enabled: enabled && !!requestId,
  });
}
