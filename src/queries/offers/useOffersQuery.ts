import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getOffers } from '@/services/offer.service';

export function useOffersQuery(status?: string) {
  return useQuery({
    queryKey: queryKeys.offers({ status }),
    queryFn: () => getOffers(status),
  });
}
