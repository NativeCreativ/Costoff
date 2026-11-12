'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getClientPhasesReport, getReadyToJoinReport, getTodaysInterviewsReport } from '@/services/report.service';

/** Reports are read-only snapshots; a short stale time keeps drill-down back/forth instant. */
const STALE_TIME_MS = 30 * 1000;

export function useClientPhasesReport(companyId: string | null, includeClosed: boolean) {
  return useQuery({
    queryKey: queryKeys.reportClientPhases(companyId, includeClosed),
    queryFn: () => getClientPhasesReport(companyId, includeClosed),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}

export function useTodaysInterviewsReport(date: string | null) {
  return useQuery({
    queryKey: queryKeys.reportTodaysInterviews(date),
    queryFn: () => getTodaysInterviewsReport(date),
    staleTime: STALE_TIME_MS,
  });
}

export function useReadyToJoinReport(skillGroup: string | null, location: string | null) {
  return useQuery({
    queryKey: queryKeys.reportReadyToJoin(skillGroup, location),
    queryFn: () => getReadyToJoinReport(skillGroup, location),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}
