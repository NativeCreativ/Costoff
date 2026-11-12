import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getSettings } from '@/services/settings.service';

export function useSettingsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
    enabled,
  });
}
