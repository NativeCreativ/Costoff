import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getUsers, UserFilters } from '@/services/user.service';

const STALE_TIME_MS = 30 * 1000;

export function useUsersQuery(filters: UserFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.users(filters),
    queryFn: () => getUsers(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
    enabled: options.enabled ?? true,
  });
}
