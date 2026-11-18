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

export interface TodaysInterviewsReport {
  date: string;
  total: number;
  summary: { status: string; count: number }[];
  interviews: ReportInterview[];
}

export async function getTodaysInterviewsReport(date: string | null): Promise<TodaysInterviewsReport> {
  const { data } = await api.get('/reports/todays-interviews', { params: date ? { date } : {} });
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

export async function getContributionReport(from: string, to: string, userId: string | null): Promise<ContributionReport> {
  const params: Record<string, string> = { from, to };
  if (userId) params.userId = userId;
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

export async function getCandidateAgingReport(phase: string | null): Promise<{ rows: CandidateAgingRow[]; truncated: boolean }> {
  const { data } = await api.get('/reports/candidate-aging', { params: phase ? { phase } : {} });
  return { rows: data.rows ?? [], truncated: !!data.truncated };
}
