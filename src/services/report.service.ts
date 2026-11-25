import { api } from '@/lib/axios';
import type { PhaseCounts, ReportPhase } from '@/lib/reports/reportPhases';

export interface ClientPhaseRow {
  company_id: string;
  client_name: string;
  demands: number;
  positions: number;
  /** Demand aging: average and oldest days open across the client's demands, and how many are past the red-flag limit. */
  avg_days_open: number;
  max_days_open: number;
  red_flag_demands: number;
  counts: PhaseCounts;
  percents: Record<ReportPhase, number>;
}

export interface DemandPhaseRow {
  id: string;
  request_id: string;
  job_title: string | null;
  status: string | null;
  positions: number;
  days_open: number;
  counts: PhaseCounts;
  percents: Record<ReportPhase, number>;
}

export type ClientPhasesReport =
  | { level: 'client'; rows: ClientPhaseRow[] }
  | { level: 'demand'; client_name: string | null; rows: DemandPhaseRow[] };

export async function getClientPhasesReport(companyId: string | null, includeClosed: boolean): Promise<ClientPhasesReport> {
  const params: Record<string, string> = {};
  if (companyId) params.companyId = companyId;
  if (includeClosed) params.includeClosed = 'true';
  const { data } = await api.get('/reports/client-phases', { params });
  return data;
}

export interface ReportInterview {
  id: string;
  status: string;
  result: string | null;
  scheduled_date?: string | null;
  start_time: string | null;
  end_time: string | null;
  interview_type: string | null;
  mode: string | null;
  interview_location: string | null;
  round_name: string | null;
  candidate_name: string | null;
  request_id: string;
  job_title: string | null;
  client_name: string | null;
}

export interface DayInterviewSummary {
  date: string;
  count: number;
  byStatus: Record<string, number>;
}

export interface TodaysInterviewsReport {
  date: string;
  startDate?: string;
  endDate?: string;
  activeOnly?: boolean;
  total: number;
  summary: { status: string; count: number }[];
  dailyCounts?: DayInterviewSummary[];
  interviews: ReportInterview[];
}

export interface InterviewsReportParams {
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  activeOnly?: boolean;
}

export async function getTodaysInterviewsReport(params?: string | InterviewsReportParams | null): Promise<TodaysInterviewsReport> {
  const queryParams: Record<string, string> = {};
  if (typeof params === 'string') {
    if (params) queryParams.date = params;
  } else if (params) {
    if (params.date) queryParams.date = params.date;
    if (params.startDate) queryParams.startDate = params.startDate;
    if (params.endDate) queryParams.endDate = params.endDate;
    if (params.activeOnly) queryParams.activeOnly = 'true';
  }
  const { data } = await api.get('/reports/todays-interviews', { params: queryParams });
  return data;
}

export interface ReadyCandidate {
  id: string;
  full_name: string;
  current_location: string | null;
  current_company: string | null;
  current_designation: string | null;
  total_experience: string | null;
  availability: string | null;
  available_from: string | null;
  expected_ctc: number | null;
  skills: string[];
  offer_in_hand: boolean;
  offer_doj: string | null;
}

export type ReadyToJoinReport =
  | { level: 'skill_group'; today: string; total: number; groups: { id: string; name: string; count: number }[] }
  | {
      level: 'location';
      today: string;
      skill_group: string;
      location: string | null;
      locations: { name: string; key: string; count: number }[];
      candidates: ReadyCandidate[];
      limited: boolean;
    };

export async function getReadyToJoinReport(skillGroup: string | null, location: string | null): Promise<ReadyToJoinReport> {
  const params: Record<string, string> = {};
  if (skillGroup) params.skillGroup = skillGroup;
  if (skillGroup && location) params.location = location;
  const { data } = await api.get('/reports/ready-to-join', { params });
  return data;
}

/* ─────────────── Contribution (review batch 5) ─────────────── */

export type ContributionCounts = Record<import('@/lib/reports/contribution').ContributionMetric, number>;

export type ContributionReport =
  | { level: 'user'; from: string; to: string; can_see_all: boolean; rows: { user_id: string; name: string; role: string; counts: ContributionCounts }[] }
  | {
      level: 'demand';
      from: string;
      to: string;
      can_see_all: boolean;
      user: { id: string; name: string; role: string | null };
      rows: { demand_id: string; request_id: string; job_title: string | null; client_name: string | null; counts: ContributionCounts }[];
    };

export async function getContributionReport(from: string, to: string, userId: string | null, activeOnly?: boolean): Promise<ContributionReport> {
  const params: Record<string, string> = { from, to };
  if (userId) params.userId = userId;
  if (activeOnly) params.activeOnly = 'true';
  const { data } = await api.get('/reports/contribution', { params });
  return data;
}

/* ─────────────── Candidate aging (review batch 5) ─────────────── */

export interface CandidateAgingRow {
  submission_id: string;
  candidate_id: string;
  candidate_name: string;
  request_id: string;
  job_title: string | null;
  client_name: string | null;
  status: string;
  current_phase: string | null;
  days_in_current_phase: number;
  days_by_phase: Record<string, number>;
}

export async function getCandidateAgingReport(phase: string | null, activeOnly?: boolean): Promise<{ rows: CandidateAgingRow[]; truncated: boolean }> {
  const params: Record<string, string> = {};
  if (phase) params.phase = phase;
  if (activeOnly) params.activeOnly = 'true';
  const { data } = await api.get('/reports/candidate-aging', { params });
  return { rows: data.rows ?? [], truncated: !!data.truncated };
}

/* ─────────────── Smart Reports (AI) ─────────────── */

/**
 * Asks Smart Reports a question. The answer streams back as text, so this uses fetch (axios in
 * the browser cannot read a streaming body); `onText` gets each new piece as it arrives.
 */
export async function askSmartReport(question: string, onText: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/reports/smart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = 'Smart Reports could not answer right now.';
    try {
      message = (await res.json()).error || message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}
