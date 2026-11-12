import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getSkillsLibrary, getAdminSkillsLibrary } from '@/services/skillsLibrary.service';

const STALE_TIME_MS = 60 * 1000;

/** Loaded once per form open by SkillsSelector — ACTIVE categories and skills only. */
export function useSkillsLibraryQuery() {
  return useQuery({ queryKey: queryKeys.skillsLibrary, queryFn: getSkillsLibrary, staleTime: STALE_TIME_MS });
}

/** Settings view — includes inactive rows (shown muted). Separate key from the picker, so a
 *  deactivate never removes the entry from the picker cache. `refetchOnMount: 'always'` keeps
 *  usage counts fresh when the settings page opens. */
export function useSkillsLibraryQueryIncludeInactive() {
  return useQuery({
    queryKey: queryKeys.skillsLibraryIncludeInactive,
    queryFn: getAdminSkillsLibrary,
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}
