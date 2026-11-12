import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getOnboardings } from '@/services/offer.service';

export function useOnboardingsQuery(bgv?: string) {
  return useQuery({
    queryKey: queryKeys.onboardings({ bgv }),
    queryFn: () => getOnboardings(bgv),
  });
}
