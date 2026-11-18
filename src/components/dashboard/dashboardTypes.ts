/**
 * Type definitions for the Org Overview dashboard (Dashboard > Org Overview).
 *
 * Every field is populated by GET /api/dashboard from real database queries —
 * see ANALYSIS.md for the exact table/column mapping. Fields that cannot be
 * computed from real data are `null` (never a placeholder number) and the UI
 * hides the dependent sub-line / value instead of inventing one.
 */

/* ─────────────── ROW 1 — KPI cards ─────────────── */

export interface KpiData {
  /** Open (non-Closure, non-Cancelled) demands. */
  openDemands: number;
  /** Open demands currently in Sourcing or Shortlist (KPI 1 sub-line). */
  sourcingShortlist: number;
  /** Open demands past the 30-day red-flag age (KPI 2). */
  redFlagDemands: number;
  /** Non-archived candidates (KPI 3). */
  activeCandidates: number;
  /**
   * Candidates created this month minus candidates created last month
   * (KPI 3 sub-line). Null when neither month has any candidates — there is
   * no real baseline to compare against, so the UI hides the sub-line.
   */
  candidatesDelta: number | null;
  /** Interviews with scheduled_date = today (KPI 4). */
  interviewsToday: number;
  /** Completed interviews today (KPI 4 sub-line). Null when not computable. */
  interviewsCompletedToday: number | null;
  /** Upcoming interviews today (KPI 4 sub-line). Null when not computable. */
  interviewsUpcomingToday: number | null;
  /** Next interview time formatted string. */
  nextInterviewToday?: string | null;
  /** Offers with offer_date in the current month (KPI 5). */
  offersThisMonth: number;
  /** This month minus last month's offers (KPI 5 sub-line; null when both are 0). */
  offersDelta: number | null;
  /** Offers this month that have been accepted (KPI 5 sub-line). Null when not computable. */
  offersAcceptedThisMonth: number | null;
  /** Onboarding records created in the current month (KPI 6). */
  onboardingsThisMonth: number;
  /** Onboardings not yet in 'onboarded' status (KPI 6 sub-line). */
  pendingOnboardings: number | null;
}

/* ─────────────── ROW 2 ─────────────── */

export interface FunnelStage {
  key: string;
  label: string;
  /** Cumulative count of submissions that have reached this stage. */
  count: number;
  color: string;
}

export interface FunnelData {
  stages: FunnelStage[];
  /**
   * Joined / Sourced * 100, rounded.
   * - 0 when joined = 0 and sourced > 0
   * - null only when sourced = 0 (no baseline)
   */
  joinedPct: number | null;
}

export interface DemandStatusSegment {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface DemandStatusData {
  segments: DemandStatusSegment[];
  /** Sum of the five segment counts (the donut's center number). */
  total: number;
}

/* ─────────────── ROW 3 ─────────────── */

export interface TrendMonth {
  /** Stable key, e.g. "2026-10". */
  key: string;
  /** Short label, e.g. "Oct". */
  label: string;
}

export interface TrendData {
  /** Month descriptors, oldest → newest (exactly 6 calendar months ending with current month). */
  months: TrendMonth[];
  submissions: number[];
  selections: number[];
}

export interface AgingBucket {
  label: string;
  count: number;
  color: string;
}

/* ─────────────── ROW 5 (interview activity) ─────────────── */

export interface InterviewActivityDay {
  /** Day label: Mon…Sun. */
  label: string;
  count: number;
  isToday: boolean;
}

/* ─────────────── ROW 6 ─────────────── */

export type AttentionState = 'red_flag' | 'approaching' | 'on_track';

export interface AttentionRow {
  id: string;
  requestId: string;
  request_id?: string;
  requirement: string;
  company: string | null;
  company_name?: string | null;
  role: string | null;
  job_title?: string | null;
  priority: string | null;
  daysOpen: number;
  days_open?: number;
  amName: string | null;
  am_name?: string | null;
  state: AttentionState;
  isRedFlag: boolean;
}

export interface AttentionData {
  rows: AttentionRow[];
  /** Count of rows past (not merely approaching) the red-flag age across all open demands. */
  redFlagCount: number;
  /** Total open demands available. */
  totalDemands?: number;
  /** Total number of open demands matching the attention criteria. */
  totalCount: number;
}

/* ─────────────── ROW 4 & 5 (full-section roles only) ─────────────── */

export interface CompanyRow {
  id: string;
  name: string;
  open: number;
  total: number;
  submissions: number;
  interviews: number;
  offers: number;
  joined: number;
}

export interface CompanyOverviewData {
  rows: CompanyRow[];
  totalCompanies: number;
  totalCount: number;
}

export interface RecruiterRow {
  id: string;
  name: string;
  submissions: number;
  interviews: number;
}

export interface RecruiterPerformanceData {
  rows: RecruiterRow[];
  totalRecruiters: number;
  totalCount: number;
}

export interface AmRow {
  id: string;
  name: string;
  openDemands: number;
  acceptPct: number | null;
}

export interface AmPerformanceData {
  rows: AmRow[];
  totalAccountManagers: number;
  totalAms: number;
  totalCount: number;
}

export interface DashboardData {
  kpis: KpiData;
  funnel: FunnelData;
  demandStatus: DemandStatusData;
  trend: TrendData;
  aging: AgingBucket[];
  interviewActivity: InterviewActivityDay[];
  attentionRequired: AttentionData;
  /** Candidates per source + % with at least one submission (every role, candidate-scoped). */
  sourceEffectiveness: SourceEffectivenessData;
  companyOverview: CompanyOverviewData | null;
  recruiterPerformance: RecruiterPerformanceData | null;
  amPerformance: AmPerformanceData | null;
}

/* ─────────────── Shared constants ─────────────── */

/** Demands at least this many days old count as "approaching" the red-flag age. */
export const RED_FLAG_APPROACH_DAYS = 20;

/** AM offer-acceptance rate at/above which the Accept cell renders green. */
export const ACCEPTANCE_HIGH_PCT = 50;

/** Source labels for candidates.source values (see CANDIDATE_SOURCE_OPTIONS). */
export const SOURCE_LABELS: Record<string, string> = {
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  direct: 'Direct Portal',
  referral: 'Referral',
  headhunt: 'HeadHunt',
  database: 'Database',
  indeed: 'Indeed',
  others: 'Others',
};

export interface SourceEffectivenessRow {
  source: string;
  label: string;
  /** Candidates in the pool with this source. */
  count: number;
  /** Percentage of those candidates with at least one submission. */
  submittedPct: number;
  isBest: boolean;
}

/* ─────────────── Source Effectiveness with total count ─────────────── */

export interface SourceEffectivenessData {
  rows: SourceEffectivenessRow[];
  totalSources: number;
  totalCount: number;
}