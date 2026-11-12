import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getDropdownOptions } from '@/services/settings.service';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useDropdownOptionsQuery(category: string) {
  return useQuery({
    queryKey: queryKeys.dropdownOptions(category),
    queryFn: () => getDropdownOptions(category),
    staleTime: STALE_TIME_MS,
  });
}
