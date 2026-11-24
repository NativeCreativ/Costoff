'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  getCandidateAgingReport,
  getClientPhasesReport,
  getContributionReport,
  getReadyToJoinReport,
  getTodaysInterviewsReport,
  type InterviewsReportParams,
} from '@/services/report.service';

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

export function useTodaysInterviewsReport(params?: string | InterviewsReportParams | null) {
  return useQuery({
    queryKey: queryKeys.reportTodaysInterviews(params ?? null),
    queryFn: () => getTodaysInterviewsReport(params),
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

export function useContributionReport(from: string, to: string, userId: string | null, activeOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.reportContribution(from, to, userId, activeOnly),
    queryFn: () => getContributionReport(from, to, userId, activeOnly),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}

export function useCandidateAgingReport(phase: string | null, activeOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.reportCandidateAging(phase, activeOnly),
    queryFn: () => getCandidateAgingReport(phase, activeOnly),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME_MS,
  });
}
