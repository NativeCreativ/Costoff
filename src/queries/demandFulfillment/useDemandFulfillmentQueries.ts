import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  getDemandAssignments,
  getDemandStatusEvents,
  getDemandCandidates,
  getDemandCandidateDetail,
  getInterviewConfig,
  getDemandOwnInterviewRounds,
  getCalendarInterviews,
  getDemandCandidateOnboarding,
  getSuperAdminSettings,
  getCandidateDemandHistory,
  getDemandChangeLog,
  type DemandCandidatesFilters,
  type CalendarInterviewFilters,
} from '@/services/demandFulfillment.service';

const STALE_TIME_MS = 15 * 1000;

export function useDemandAssignmentsQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandAssignments(requestId || ''),
    queryFn: () => getDemandAssignments(requestId as string),
    enabled: !!requestId,
    staleTime: STALE_TIME_MS,
  });
}

export function useDemandStatusEventsQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandStatusEvents(requestId || ''),
    queryFn: () => getDemandStatusEvents(requestId as string),
    enabled: !!requestId,
    staleTime: STALE_TIME_MS,
  });
}

export function useDemandCandidatesQuery(requestId: string | null, filters: DemandCandidatesFilters = {}) {
  return useQuery({
    queryKey: queryKeys.demandCandidates(requestId || '', filters),
    queryFn: () => getDemandCandidates(requestId as string, filters),
    enabled: !!requestId,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}

export function useDemandCandidateDetailQuery(requestId: string | null, dcId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandCandidateDetail(requestId || '', dcId || ''),
    queryFn: () => getDemandCandidateDetail(requestId as string, dcId as string),
    enabled: !!requestId && !!dcId,
    staleTime: STALE_TIME_MS,
  });
}

export function useInterviewConfigQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandInterviewConfig(requestId || ''),
    queryFn: () => getInterviewConfig(requestId as string),
    enabled: !!requestId,
    staleTime: STALE_TIME_MS,
  });
}

/** Alias used by the Demand Create/Edit form, so an explicit demand configuration is always
 *  preferred over the Company/global defaults it also reads via this same query. */
export function useDemandInterviewConfigQuery(requestId: string | null) {
  return useInterviewConfigQuery(requestId);
}

/** The global Interviews & Schedules screen's Round+Mode source — this demand's OWN rounds only,
 *  never falling back to company/global (see getDemandOwnInterviewRounds). */
export function useDemandOwnInterviewRoundsQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandOwnInterviewRounds(requestId || ''),
    queryFn: () => getDemandOwnInterviewRounds(requestId as string),
    enabled: !!requestId,
    staleTime: STALE_TIME_MS,
  });
}

export function useCalendarInterviewsQuery(filters: CalendarInterviewFilters = {}, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.calendarInterviews(filters),
    queryFn: () => getCalendarInterviews(filters),
    enabled,
    staleTime: STALE_TIME_MS,
  });
}

export function useDemandCandidateOnboardingQuery(requestId: string | null, dcId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandOnboarding(requestId || '', dcId || ''),
    queryFn: () => getDemandCandidateOnboarding(requestId as string, dcId as string),
    enabled: !!requestId && !!dcId,
    staleTime: STALE_TIME_MS,
  });
}

export function useCandidateDemandHistoryQuery(candidateId: string | null, excludeDemandId?: string) {
  return useQuery({
    queryKey: queryKeys.candidateDemandHistory(candidateId || '', excludeDemandId),
    queryFn: () => getCandidateDemandHistory(candidateId as string, excludeDemandId),
    enabled: !!candidateId,
    staleTime: STALE_TIME_MS,
  });
}

export function useSuperAdminSettingsDFQuery() {
  return useQuery({
    queryKey: queryKeys.superAdminSettingsDF,
    queryFn: () => getSuperAdminSettings(),
    staleTime: STALE_TIME_MS,
  });
}

/** Settings view variant — requests includeInactive so inactive rows are shown muted.
 *  Uses a separate query key from the form pickers. `refetchOnMount: 'always'` so usage
 *  counts and menu badges refresh whenever the settings page is opened. */
export function useSuperAdminSettingsDFQueryIncludeInactive() {
  return useQuery({
    queryKey: queryKeys.superAdminSettingsDFIncludeInactive,
    queryFn: () => getSuperAdminSettings(true),
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}

/** Change Log tab: demand fields, candidates (all phases), assignments and status, newest first. */
export function useDemandChangeLogQuery(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.demandChangeLog(requestId || ''),
    queryFn: () => getDemandChangeLog(requestId as string),
    enabled: !!requestId,
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}
