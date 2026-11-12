import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getCompensationCurrencies, getCompensationTypes } from '@/services/compensationMaster.service';

const STALE_TIME_MS = 60 * 1000;

/** Form pickers — ACTIVE items only. */
export function useCompensationCurrenciesQuery() {
  return useQuery({
    queryKey: queryKeys.compensationCurrencies,
    queryFn: () => getCompensationCurrencies(false),
    staleTime: STALE_TIME_MS,
  });
}

/** Settings view — includes inactive rows (shown muted). Separate key from the form pickers.
 *  `refetchOnMount: 'always'` so usage counts and menu badges are fresh whenever the settings
 *  page (and therefore the list) is opened again. */
export function useCompensationCurrenciesQueryIncludeInactive() {
  return useQuery({
    queryKey: queryKeys.compensationCurrenciesIncludeInactive,
    queryFn: () => getCompensationCurrencies(true),
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}

/** Form pickers — ACTIVE items only. */
export function useCompensationTypesQuery() {
  return useQuery({
    queryKey: queryKeys.compensationTypes,
    queryFn: () => getCompensationTypes(false),
    staleTime: STALE_TIME_MS,
  });
}

/** Settings view — includes inactive rows (shown muted). Separate key from the form pickers.
 *  `refetchOnMount: 'always'` so usage counts and menu badges are fresh when the page opens. */
export function useCompensationTypesQueryIncludeInactive() {
  return useQuery({
    queryKey: queryKeys.compensationTypesIncludeInactive,
    queryFn: () => getCompensationTypes(true),
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}
