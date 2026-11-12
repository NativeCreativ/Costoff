import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import {
  DEMANDS_WITH_AGING_BASE,
  DEMAND_RED_FLAG_DAYS,
  DEMAND_APPROACHING_DAYS,
} from '@/lib/demands/demandAgingQuery';
import { buildDashboardDemandCondition } from '@/lib/auth/demandVisibility';
import { buildCandidateVisibilityCondition } from '@/lib/auth/candidatePermissions';
import { rawIdentifier } from '@/lib/auth/rawSqlIdentifier';
import {
  SUBMISSION_FORWARD_ORDER,
  SUBMISSION_TERMINAL_EXIT_STATUSES,
  DEMAND_LIFECYCLE_STATUS_VALUES,
  RECRUITER_PROFILE_ROLE,
} from '@/lib/demandFulfillment/constants';
import {
  SOURCE_LABELS,
  type DashboardData,
  type FunnelStage,
  type DemandStatusSegment,
  type AgingBucket,
  type InterviewActivityDay,
  type AttentionRow,
  type AttentionData,
  type AttentionState,
  type CompanyRow,
  type CompanyOverviewData,
  type RecruiterRow,
  type RecruiterPerformanceData,
  type AmRow,
  type AmPerformanceData,
  type SourceEffectivenessRow,
  type SourceEffectivenessData,
  type TrendMonth,
} from '@/components/dashboard/dashboardTypes';

/**
 * GET /api/dashboard — every number on the Org Overview dashboard.
 *
 * DATA INTEGRITY: every value is computed from a real query below. There
 * are no fallbacks, no `|| 0` masking and no invented numbers — a real 0
 * is returned as 0, and a value that cannot be computed is returned as
 * null so the UI hides it.
 *
 * AUTH & SCOPE (enforced here, mirrored by the UI):
 *  - Every request is authenticated (requireAuth).
 *  - Demand-derived sections are scoped by buildDemandVisibilityCondition
 *    (super_admin / account_manager / hr / viewer see all demands; spoc
 *    sees demands where they are the SPOC; ta sees demands they are
 *    allocated to).
 *  - Candidate-derived sections (active candidates, source effectiveness)
 *    are scoped by buildCandidateVisibilityCondition (ta sees the whole
 *    pool; spoc / account_manager only candidates on their own demands).
 *  - Company Overview, Recruiter Performance and AM Performance are
 *    computed and returned ONLY for super_admin, account_manager and spoc —
 *    for ta they are not queried at all and the response carries `null`.
 *    For spoc every query in that block is demand-scoped, so the sections
 *    cover only the demands they are the SPOC of (see FULL_SECTION_ROLES).
 */

/**
 * Roles allowed to see the Company / Recruiter / AM performance sections.
 *
 * `spoc` is included: a SPOC needs to see which companies, recruiters and AMs
 * their own demands sit with. Because a SPOC may only see their own demands,
 * every query in the `fullSections` block below is scoped through
 * `buildDemandVisibilityCondition` — for super_admin / account_manager that
 * condition is null (they see all), and for spoc it restricts the aggregation
 * to demands where they are the SPOC. So adding spoc here reveals the SECTION,
 * never another team's numbers.
 */
const FULL_SECTION_ROLES = ['super_admin', 'account_manager', 'spoc'];

/** Funnel stages, in funnel order, mapped to submissions.current_status. */
const FUNNEL_STAGE_DEFS: { key: string; label: string; color: string }[] = [
  { key: 'sourced', label: 'Sourced', color: '#1e40af' },
  { key: 'submitted_to_spoc', label: 'Submitted to SPOC', color: '#2563eb' },
  { key: 'sent_to_customer', label: 'Sent to Customer', color: '#3b82f6' },
  { key: 'interview_scheduled', label: 'Interview Scheduled', color: '#60a5fa' },
  { key: 'selected', label: 'Selected', color: '#0d9488' },
  { key: 'offer_released', label: 'Offer Released', color: '#d97706' },
  { key: 'joined', label: 'Joined', color: '#15803d' },
];

/** Demand Status donut segments, mapped 1:1 to demands.status. */
const DEMAND_STATUS_DEFS: { key: string; label: string; color: string }[] = [
  { key: 'Open', label: 'Open', color: '#e2e8f0' },
  { key: 'Assign', label: 'Assign', color: '#cbd5e1' },
  { key: 'Sourcing', label: 'Sourcing', color: '#1d4ed8' },
  { key: 'Shortlist', label: 'Shortlist', color: '#60a5fa' },
  { key: 'Selection', label: 'Selection', color: '#0d9488' },
  { key: 'Onboarding', label: 'Onboarding', color: '#d97706' },
];

/** Demand Aging buckets (days open) with their spec colors. */
const AGING_DEFS: { label: string; color: string }[] = [
  { label: '0–7d', color: '#93c5fd' },
  { label: '8–14d', color: '#93c5fd' },
  { label: '15–30d', color: '#fbbf24' },
  { label: '31–60d', color: '#ef4444' },
  { label: '60d+', color: '#b91c1c' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "h:mm AM" from a DB time value (string "HH:MM:SS" from raw SQL, or a Date). */
function formatTimeOfDay(value: unknown): string | null {
  if (value == null) return null;
  let hours = 0;
  let minutes = 0;
  if (value instanceof Date) {
    hours = value.getHours();
    minutes = value.getMinutes();
  } else {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value));
    if (!match) return null;
    hours = Number(match[1]);
    minutes = Number(match[2]);
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

interface RawCountRow { count: number }

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const fullSections = FULL_SECTION_ROLES.includes(user.role);

    // Demand-scope conditions. `vScope` qualifies columns of the
    // DEMANDS_WITH_AGING_BASE derived table aliased `v`;
    // `scopedToDemand(alias)` produces the same predicate for rows of
    // any child table (interviews / offers / onboardings / submissions)
    // via the child's demand_id.
    const vCondition = buildDashboardDemandCondition(user);
    const vScope = vCondition ? Prisma.sql`AND ${vCondition}` : Prisma.empty;
    const scopedToDemand = (alias: string) =>
      vCondition
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM (${DEMANDS_WITH_AGING_BASE}) v
            WHERE v.id = ${rawIdentifier(alias)}.demand_id ${vScope}
          )`
        : Prisma.empty;
    // Same predicate aimed at a RAW `demands d` alias (the full-section queries
    // below join the `demands` table directly instead of the aging derived table).
    // Needed because spoc is in FULL_SECTION_ROLES: without this, adding spoc to
    // that list would hand them org-wide company / recruiter / AM numbers.
    const demandScope = (alias: string) => {
      const condition = buildDashboardDemandCondition(user, alias);
      return condition ? Prisma.sql`AND ${condition}` : Prisma.empty;
    };
    // Recruiter / AM Performance iterate every `profiles p` row, so scoping the
    // per-recruiter subqueries is not enough — a recruiter with no visible demand
    // would still be listed (their counts simply read 0). These two keep such rows
    // out of the result entirely, so a spoc sees only the recruiters and AMs their
    // own demands actually involve.
    const recruiterDemandScope = (profileAlias: string) =>
      vCondition
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM submissions rs
            JOIN demands d ON d.id = rs.demand_id
            WHERE rs.submitted_by_ta = ${rawIdentifier(profileAlias)}.id ${demandScope('d')}
          )`
        : Prisma.empty;
    const amDemandScope = (profileAlias: string) =>
      vCondition
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM demands d
            WHERE d.contact_profile_id = ${rawIdentifier(profileAlias)}.id ${demandScope('d')}
          )`
        : Prisma.empty;
    const candidateCondition = buildCandidateVisibilityCondition(
      { role: user.role, id: user.userId },
      'c',
    );
    const candidateScope =
      candidateCondition === Prisma.empty ? Prisma.empty : Prisma.sql`AND ${candidateCondition}`;

    // ── Always-computed sections ──────────────────────────────────

    const [
      openDemandRows,
      redFlagRows,
      candidateRows,
      interviewTodayRows,
      nextInterviewRows,
      offerRows,
      onboardingRows,
      funnelRows,
      statusRows,
      submissionTrendRows,
      selectionTrendRows,
      agingRows,
      activityRows,
      todayDowRows,
      attentionRows,
      sourceRows,
    ] = await Promise.all([
      // KPI 1: open demands + demands in Sourcing/Shortlist.
      prisma.$queryRaw<{ open_demands: number; sourcing_shortlist: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE v.status NOT IN ('Closure', 'Cancelled'))::int AS open_demands,
          COUNT(*) FILTER (WHERE v.status IN ('Sourcing', 'Shortlist'))::int AS sourcing_shortlist
        FROM (${DEMANDS_WITH_AGING_BASE}) v
        WHERE TRUE ${vScope}
      `,
      // KPI 2: open demands past the 30-day red-flag age.
      prisma.$queryRaw<RawCountRow[]>`
        SELECT COUNT(*)::int AS count
        FROM (${DEMANDS_WITH_AGING_BASE}) v
        WHERE v.is_red_flag = true
          AND v.status NOT IN ('Closure', 'Cancelled')
          ${vScope}
      `,
      // KPI 3: active candidates + this/last month's new candidates (computed in Asia/Kolkata).
      prisma.$queryRaw<{ active: number; this_month: number; last_month: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(c.profile_archived, false) = false)::int AS active,
          COUNT(*) FILTER (WHERE COALESCE(c.profile_archived, false) = false
            AND date_trunc('month', (c.created_at AT TIME ZONE 'Asia/Kolkata')) = date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')))::int AS this_month,
          COUNT(*) FILTER (WHERE COALESCE(c.profile_archived, false) = false
            AND date_trunc('month', (c.created_at AT TIME ZONE 'Asia/Kolkata')) = date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) - interval '1 month')::int AS last_month
        FROM candidates c
        WHERE TRUE ${candidateScope}
      `,
      // KPI 4: interviews scheduled today (total, completed, upcoming in Asia/Kolkata).
      prisma.$queryRaw<{ count: number; completed: number; upcoming: number }[]>`
        SELECT
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE i.status = 'Completed')::int AS completed,
          COUNT(*) FILTER (
            WHERE i.status = 'Scheduled'
              AND (i.scheduled_time IS NULL OR i.scheduled_time >= (NOW() AT TIME ZONE 'Asia/Kolkata')::time)
          )::int AS upcoming
        FROM interviews i
        WHERE i.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          ${scopedToDemand('i')}
      `,
      // KPI 4 sub-line: next upcoming interview later today.
      prisma.$queryRaw<{ scheduled_time: unknown }[]>`
        SELECT i.scheduled_time
        FROM interviews i
        WHERE i.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND i.scheduled_time IS NOT NULL
          AND i.scheduled_time > (NOW() AT TIME ZONE 'Asia/Kolkata')::time
          ${scopedToDemand('i')}
        ORDER BY i.scheduled_time ASC
        LIMIT 1
      `,
      // KPI 5: offers this month vs last month + accepted offers this month (Asia/Kolkata).
      prisma.$queryRaw<{ this_month: number; accepted_this_month: number; last_month: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE date_trunc('month', (o.offer_date AT TIME ZONE 'Asia/Kolkata')) = date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')))::int AS this_month,
          COUNT(*) FILTER (WHERE date_trunc('month', (o.offer_date AT TIME ZONE 'Asia/Kolkata')) = date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) AND o.status = 'Accepted')::int AS accepted_this_month,
          COUNT(*) FILTER (WHERE date_trunc('month', (o.offer_date AT TIME ZONE 'Asia/Kolkata')) = date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) - interval '1 month')::int AS last_month
        FROM offers o
        WHERE TRUE ${scopedToDemand('o')}
      `,
      // KPI 6: onboardings created this month + pending onboardings (Asia/Kolkata).
      prisma.$queryRaw<{ this_month: number; pending: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE date_trunc('month', (o.created_at AT TIME ZONE 'Asia/Kolkata')) = date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata')))::int AS this_month,
          COUNT(*) FILTER (WHERE o.status IS DISTINCT FROM 'onboarded')::int AS pending
        FROM onboardings o
        WHERE TRUE ${scopedToDemand('o')}
      `,
      // Funnel: submissions per current_status. Terminal exits
      // (rejected / dropped / backed_out) are excluded — their peak
      // stage is not recoverable from the data.
      prisma.$queryRaw<{ current_status: string; count: number }[]>`
        SELECT s.current_status AS current_status, COUNT(*)::int AS count
        FROM submissions s
        WHERE s.current_status NOT IN (${Prisma.join(SUBMISSION_TERMINAL_EXIT_STATUSES)})
          ${scopedToDemand('s')}
        GROUP BY s.current_status
      `,
      // Demand Status donut: open demands by lifecycle status.
      prisma.$queryRaw<{ status: string; count: number }[]>`
        SELECT v.status AS status, COUNT(*)::int AS count
        FROM (${DEMANDS_WITH_AGING_BASE}) v
        WHERE v.status IN (${Prisma.join(DEMAND_LIFECYCLE_STATUS_VALUES)})
          ${vScope}
        GROUP BY v.status
      `,
      // Trend: submissions created per month, last 6 calendar months (Asia/Kolkata).
      prisma.$queryRaw<{ month_key: string; count: number }[]>`
        SELECT
          to_char((s.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month_key,
          COUNT(*)::int AS count
        FROM submissions s
        WHERE s.created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata') - interval '5 months') AT TIME ZONE 'Asia/Kolkata'
          ${scopedToDemand('s')}
        GROUP BY 1
      `,
      // Trend: selections that reached 'selected' per month (Asia/Kolkata).
      prisma.$queryRaw<{ month_key: string; count: number }[]>`
        SELECT
          to_char((se.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month_key,
          COUNT(*)::int AS count
        FROM submission_events se
        JOIN submissions s ON s.id = se.submission_id
        WHERE se.event_type = 'status_change'
          AND se.to_status = 'selected'
          AND se.created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata') - interval '5 months') AT TIME ZONE 'Asia/Kolkata'
          ${scopedToDemand('s')}
        GROUP BY 1
      `,
      // Demand Aging: open demands by days-open bucket.
      prisma.$queryRaw<{ b0: number; b1: number; b2: number; b3: number; b4: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE v.days_open BETWEEN 0 AND 7)::int AS b0,
          COUNT(*) FILTER (WHERE v.days_open BETWEEN 8 AND 14)::int AS b1,
          COUNT(*) FILTER (WHERE v.days_open BETWEEN 15 AND 30)::int AS b2,
          COUNT(*) FILTER (WHERE v.days_open BETWEEN 31 AND 60)::int AS b3,
          COUNT(*) FILTER (WHERE v.days_open > 60)::int AS b4
        FROM (${DEMANDS_WITH_AGING_BASE}) v
        WHERE v.status NOT IN ('Closure', 'Cancelled')
          ${vScope}
      `,
      // Interview Activity: interviews per ISO weekday, current week (Mon–Sun) in Asia/Kolkata.
      prisma.$queryRaw<{ dow: number; count: number }[]>`
        SELECT EXTRACT(ISODOW FROM (i.scheduled_date AT TIME ZONE 'Asia/Kolkata'))::int AS dow, COUNT(*)::int AS count
        FROM interviews i
        WHERE i.scheduled_date >= (date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata'))::date
          AND i.scheduled_date < (date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata')::date + 7)
          ${scopedToDemand('i')}
        GROUP BY 1
      `,
      // Which ISO weekday is today (for the activity chart highlight in Asia/Kolkata).
      prisma.$queryRaw<{ dow: number }[]>`
        SELECT EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Asia/Kolkata'))::int AS dow
      `,
      // Attention Required: top 5 open demands sorted by red flag > approaching > high priority > days_open desc.
      prisma.$queryRaw<{
        id: string;
        request_id: string;
        skill_description: string;
        job_title: string | null;
        company_name: string | null;
        priority: string | null;
        days_open: number;
        am_name: string | null;
        state: string;
      }[]>`
        SELECT
          v.id,
          v.request_id,
          v.skill_description,
          COALESCE(v.job_title, v.role_category, v.skill_description) AS job_title,
          COALESCE(co.name, v.company_name, v.client_name) AS company_name,
          v.priority,
          v.days_open,
          v.am_name,
          CASE
            WHEN v.days_open > ${DEMAND_RED_FLAG_DAYS} THEN 'red_flag'
            WHEN v.days_open >= ${DEMAND_APPROACHING_DAYS} THEN 'approaching'
            ELSE 'on_track'
          END AS state
        FROM (${DEMANDS_WITH_AGING_BASE}) v
        LEFT JOIN companies co ON co.id = v.company_id
        WHERE v.status NOT IN ('Closure', 'Cancelled')
          ${vScope}
        ORDER BY
          CASE
            WHEN v.days_open > ${DEMAND_RED_FLAG_DAYS} THEN 0
            WHEN v.days_open >= ${DEMAND_APPROACHING_DAYS} THEN 1
            ELSE 2
          END ASC,
          CASE
            WHEN LOWER(v.priority) = 'high' THEN 0
            ELSE 1
          END ASC,
          v.days_open DESC,
          v.request_id ASC
        LIMIT 5
      `,
      // Source Effectiveness: top 5 sources by candidate count, with total sources available.
      prisma.$queryRaw<{ source: string; count: number; submitted: number; total_count: number }[]>`
        WITH source_counts AS (
          SELECT
            c.source AS source,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM submissions s WHERE s.candidate_id = c.id))::int AS submitted
          FROM candidates c
          WHERE TRUE ${candidateScope}
            AND c.source IS NOT NULL
          GROUP BY c.source
        )
        SELECT
          source,
          count,
          submitted,
          (SELECT COUNT(*)::int FROM source_counts) AS total_count
        FROM source_counts
        ORDER BY count DESC, source ASC
        LIMIT 5
      `,
    ]);

    // ── Build the always-visible sections ─────────────────────────

    const openDemands = Number(openDemandRows[0]?.open_demands ?? 0);
    const sourcingShortlist = Number(openDemandRows[0]?.sourcing_shortlist ?? 0);
    const redFlagDemands = Number(redFlagRows[0]?.count ?? 0);

    const candidateRow = candidateRows[0];
    const activeCandidates = Number(candidateRow?.active ?? 0);
    const candidatesThisMonth = Number(candidateRow?.this_month ?? 0);
    const candidatesLastMonth = Number(candidateRow?.last_month ?? 0);
    const candidatesDelta =
      candidatesThisMonth > 0 || candidatesLastMonth > 0
        ? candidatesThisMonth - candidatesLastMonth
        : null;

    const interviewTodayRow = interviewTodayRows[0];
    const interviewsToday = Number(interviewTodayRow?.count ?? 0);
    const interviewsCompletedToday = interviewsToday > 0 ? Number(interviewTodayRow?.completed ?? 0) : null;
    const interviewsUpcomingToday = interviewsToday > 0 ? Number(interviewTodayRow?.upcoming ?? 0) : null;
    const nextInterviewToday = formatTimeOfDay(nextInterviewRows[0]?.scheduled_time ?? null);

    const offerRow = offerRows[0];
    const offersThisMonth = Number(offerRow?.this_month ?? 0);
    const offersAcceptedThisMonth = offersThisMonth > 0 ? Number(offerRow?.accepted_this_month ?? 0) : null;
    const offersLastMonth = Number(offerRow?.last_month ?? 0);
    const offersDelta =
      offersThisMonth > 0 || offersLastMonth > 0
        ? offersThisMonth - offersLastMonth
        : null;

    const onboardingRow = onboardingRows[0];
    const onboardingsThisMonth = Number(onboardingRow?.this_month ?? 0);
    const pendingOnboardings =
      onboardingsThisMonth > 0 || Number(onboardingRow?.pending ?? 0) > 0
        ? Number(onboardingRow?.pending ?? 0)
        : null;

    // Funnel: cumulative counts over SUBMISSION_FORWARD_ORDER.
    const statusCounts = new Map(funnelRows.map((r) => [r.current_status, Number(r.count)]));
    const positionOf = (status: string) =>
      (SUBMISSION_FORWARD_ORDER as readonly string[]).indexOf(status);
    const funnelStages: FunnelStage[] = FUNNEL_STAGE_DEFS.map((def) => {
      const stagePosition = positionOf(def.key);
      let count = 0;
      for (const [status, countAtStatus] of statusCounts) {
        const position = positionOf(status);
        if (position >= 0 && stagePosition >= 0 && position >= stagePosition) {
          count += countAtStatus;
        }
      }
      return { ...def, count };
    });
    const sourcedCount = funnelStages[0]?.count ?? 0;
    const joinedCount = funnelStages[funnelStages.length - 1]?.count ?? 0;
    // Sourced -> Joined percentage: 0 when joined = 0 and sourced > 0; null only when sourced = 0.
    const joinedPct = sourcedCount > 0 ? Math.round((joinedCount / sourcedCount) * 100) : null;

    // Demand Status donut.
    const statusCountMap = new Map(statusRows.map((r) => [r.status, Number(r.count)]));
    const demandStatusSegments: DemandStatusSegment[] = DEMAND_STATUS_DEFS.map((def) => ({
      ...def,
      count: Number(statusCountMap.get(def.key) ?? 0),
    }));
    const demandStatusTotal = demandStatusSegments.reduce((sum, segment) => sum + segment.count, 0);

    // Trend: exactly 6 calendar months ending with the CURRENT month in Asia/Kolkata.
    const kolkataDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date()).split('-');
    const curYear = parseInt(kolkataDateParts[0], 10);
    const curMonth = parseInt(kolkataDateParts[1], 10); // 1-12

    const subByMonth = new Map(submissionTrendRows.map((r) => [r.month_key, Number(r.count)]));
    const selByMonth = new Map(selectionTrendRows.map((r) => [r.month_key, Number(r.count)]));
    const trendMonths: TrendMonth[] = [];
    const trendSubmissions: number[] = [];
    const trendSelections: number[] = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      let y = curYear;
      let m = curMonth - offset;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const label = MONTH_NAMES[m - 1];
      trendMonths.push({ key, label });
      trendSubmissions.push(subByMonth.get(key) ?? 0);
      trendSelections.push(selByMonth.get(key) ?? 0);
    }

    // Demand Aging buckets.
    const agingRow = agingRows[0];
    const aging: AgingBucket[] = AGING_DEFS.map((def, index) => ({
      ...def,
      count: Number(agingRow?.[`b${index}` as 'b0'] ?? 0),
    }));

    // Interview Activity: Mon–Sun for the current week.
    const activityByDow = new Map(activityRows.map((r) => [Number(r.dow), Number(r.count)]));
    const todayDow = Number(todayDowRows[0]?.dow ?? 0);
    const interviewActivity: InterviewActivityDay[] = DAY_LABELS.map((label, index) => {
      const dow = index + 1; // ISODOW: 1 = Monday … 7 = Sunday
      return { label, count: Number(activityByDow.get(dow) ?? 0), isToday: dow === todayDow };
    });

    // Attention Required.
    const attentionMapped: AttentionRow[] = openDemands === 0
      ? []
      : attentionRows.map((r) => {
          const state = r.state as AttentionState;
          return {
            id: r.id,
            requestId: r.request_id,
            request_id: r.request_id,
            requirement: r.skill_description,
            company: r.company_name,
            company_name: r.company_name,
            role: r.job_title,
            job_title: r.job_title,
            priority: r.priority,
            daysOpen: Number(r.days_open),
            days_open: Number(r.days_open),
            amName: r.am_name,
            am_name: r.am_name,
            state,
            isRedFlag: state === 'red_flag',
          };
        });
    const attentionRequired: AttentionData = {
      rows: attentionMapped,
      redFlagCount: redFlagDemands,
      totalDemands: openDemands,
      totalCount: openDemands,
    };

    // Source Effectiveness: top 5 sources by candidate count, with total sources available.
    const totalSources = Number(sourceRows[0]?.total_count ?? 0);
    const sourceEffectivenessRows: SourceEffectivenessRow[] = sourceRows.map((r) => ({
      source: r.source,
      label: SOURCE_LABELS[r.source] ?? r.source,
      count: Number(r.count),
      submittedPct:
        Number(r.count) > 0 ? Math.round((Number(r.submitted) / Number(r.count)) * 100) : 0,
      isBest: false,
    }));
    if (sourceEffectivenessRows.length > 0) {
      const best = [...sourceEffectivenessRows].sort(
        (a, b) => b.submittedPct - a.submittedPct || b.count - a.count || a.label.localeCompare(b.label),
      )[0];
      best.isBest = true;
    }
    const sourceEffectiveness: SourceEffectivenessData = {
      rows: sourceEffectivenessRows,
      totalSources,
      totalCount: totalSources,
    };

    // ── Full-section roles only: Company / Recruiter / AM performance ─

    let companyOverview: CompanyOverviewData | null = null;
    let recruiterPerformance: RecruiterPerformanceData | null = null;
    let amPerformance: AmPerformanceData | null = null;

    if (fullSections) {
      const [
        companyOverviewRows,
        recruiterPerfRows,
        amPerfRows,
      ] = await Promise.all([
        // Company Overview: top 5 companies by submissions (tie-break: open demands desc, then name) with total count in SQL.
        prisma.$queryRaw<{
          id: string;
          name: string;
          open: number;
          total: number;
          submissions: number;
          interviews: number;
          offers: number;
          joined: number;
          total_companies: number;
        }[]>`
          WITH company_demands AS (
            SELECT
              company_id,
              COUNT(*) FILTER (WHERE status NOT IN ('Closure', 'Cancelled'))::int AS open_demands,
              COUNT(*)::int AS total_demands
            FROM demands d
            WHERE d.company_id IS NOT NULL
              ${demandScope('d')}
            GROUP BY d.company_id
          ),
          company_submissions AS (
            SELECT d.company_id, COUNT(*)::int AS submissions
            FROM submissions s
            JOIN demands d ON d.id = s.demand_id
            WHERE d.company_id IS NOT NULL
              ${demandScope('d')}
            GROUP BY d.company_id
          ),
          company_interviews AS (
            SELECT d.company_id, COUNT(*)::int AS interviews
            FROM interviews i
            JOIN demands d ON d.id = i.demand_id
            WHERE d.company_id IS NOT NULL
              ${demandScope('d')}
            GROUP BY d.company_id
          ),
          company_offers AS (
            SELECT d.company_id, COUNT(*)::int AS offers
            FROM offers o
            JOIN demands d ON d.id = o.demand_id
            WHERE d.company_id IS NOT NULL
              ${demandScope('d')}
            GROUP BY d.company_id
          ),
          company_joined AS (
            SELECT d.company_id, COUNT(*)::int AS joined
            FROM onboardings ob
            JOIN demands d ON d.id = ob.demand_id
            WHERE d.company_id IS NOT NULL AND ob.status = 'onboarded'
              ${demandScope('d')}
            GROUP BY d.company_id
          ),
          all_companies AS (
            SELECT
              co.id,
              co.name,
              COALESCE(cd.open_demands, 0)::int AS open,
              COALESCE(cd.total_demands, 0)::int AS total,
              COALESCE(cs.submissions, 0)::int AS submissions,
              COALESCE(ci.interviews, 0)::int AS interviews,
              COALESCE(cofr.offers, 0)::int AS offers,
              COALESCE(cj.joined, 0)::int AS joined
            FROM companies co
            JOIN company_demands cd ON cd.company_id = co.id
            LEFT JOIN company_submissions cs ON cs.company_id = co.id
            LEFT JOIN company_interviews ci ON ci.company_id = co.id
            LEFT JOIN company_offers cofr ON cofr.company_id = co.id
            LEFT JOIN company_joined cj ON cj.company_id = co.id
            WHERE cd.total_demands > 0
          )
          SELECT
            id,
            name,
            open,
            total,
            submissions,
            interviews,
            offers,
            joined,
            (SELECT COUNT(*)::int FROM all_companies) AS total_companies
          FROM all_companies
          ORDER BY submissions DESC, open DESC, name ASC
          LIMIT 5
        `,
        // Recruiter Performance: top 5 recruiters by submissions MTD (excluding 0 submissions AND 0 interviews) with total count in SQL.
        prisma.$queryRaw<{
          id: string;
          name: string;
          submissions: number;
          interviews: number;
          total_recruiters: number;
        }[]>`
          WITH recruiter_stats AS (
            SELECT
              p.id,
              p.full_name AS name,
              (
                SELECT COUNT(*)::int
                FROM submissions s
                JOIN demands d ON d.id = s.demand_id
                WHERE s.submitted_by_ta = p.id
                  ${demandScope('d')}
                  AND s.created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata')) AT TIME ZONE 'Asia/Kolkata'
              ) AS submissions,
              (
                SELECT COUNT(*)::int
                FROM interviews i
                JOIN demands d ON d.id = i.demand_id
                WHERE i.created_by = p.id
                  ${demandScope('d')}
                  AND (
                    i.created_at >= (date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata')) AT TIME ZONE 'Asia/Kolkata'
                    OR (i.created_at IS NULL AND i.scheduled_date >= (date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata'))::date)
                  )
              ) AS interviews
            FROM profiles p
            WHERE p.role = ${RECRUITER_PROFILE_ROLE}
              ${recruiterDemandScope('p')}
          ),
          active_recruiters AS (
            SELECT *
            FROM recruiter_stats
            WHERE NOT (submissions = 0 AND interviews = 0)
          )
          SELECT
            id,
            name,
            submissions,
            interviews,
            (SELECT COUNT(*)::int FROM active_recruiters) AS total_recruiters
          FROM active_recruiters
          ORDER BY submissions DESC, interviews DESC, name ASC
          LIMIT 5
        `,
        // AM Performance: top 5 account managers by open demands (excluding 0 open demands) with total count in SQL.
        prisma.$queryRaw<{
          id: string;
          name: string;
          open_demands: number;
          accept_pct: number | null;
          total_ams: number;
        }[]>`
          WITH am_stats AS (
            SELECT
              p.id,
              p.full_name AS name,
              (
                SELECT COUNT(*)::int
                FROM demands d
                WHERE d.contact_profile_id = p.id
                  ${demandScope('d')}
                  AND d.status NOT IN ('Closure', 'Cancelled')
              ) AS open_demands,
              (
                SELECT COUNT(*)::int
                FROM offers o
                JOIN demands d ON d.id = o.demand_id
                WHERE d.contact_profile_id = p.id
                  ${demandScope('d')}
              ) AS total_offers,
              (
                SELECT COUNT(*)::int
                FROM offers o
                JOIN demands d ON d.id = o.demand_id
                WHERE d.contact_profile_id = p.id
                  ${demandScope('d')}
                  AND o.status = 'Accepted'
              ) AS accepted_offers
            FROM profiles p
            WHERE p.role = 'account_manager'
              ${amDemandScope('p')}
          ),
          active_ams AS (
            SELECT
              id,
              name,
              open_demands,
              total_offers,
              accepted_offers,
              CASE
                WHEN total_offers > 0 THEN ROUND((accepted_offers::numeric / total_offers::numeric) * 100)::int
                ELSE NULL
              END AS accept_pct
            FROM am_stats
            WHERE open_demands > 0
          )
          SELECT
            id,
            name,
            open_demands,
            accept_pct,
            (SELECT COUNT(*)::int FROM active_ams) AS total_ams
          FROM active_ams
          ORDER BY open_demands DESC, COALESCE(accept_pct, -1) DESC, name ASC
          LIMIT 5
        `,
      ]);

      const totalCompanies = Number(companyOverviewRows[0]?.total_companies ?? 0);
      companyOverview = {
        rows: companyOverviewRows.map((r) => ({
          id: r.id,
          name: r.name,
          open: Number(r.open),
          total: Number(r.total),
          submissions: Number(r.submissions),
          interviews: Number(r.interviews),
          offers: Number(r.offers),
          joined: Number(r.joined),
        })),
        totalCompanies,
        totalCount: totalCompanies,
      };

      const totalRecruiters = Number(recruiterPerfRows[0]?.total_recruiters ?? 0);
      recruiterPerformance = {
        rows: recruiterPerfRows.map((r) => ({
          id: r.id,
          name: r.name,
          submissions: Number(r.submissions),
          interviews: Number(r.interviews),
        })),
        totalRecruiters,
        totalCount: totalRecruiters,
      };

      const totalAms = Number(amPerfRows[0]?.total_ams ?? 0);
      amPerformance = {
        rows: amPerfRows.map((r) => ({
          id: r.id,
          name: r.name,
          openDemands: Number(r.open_demands),
          acceptPct: r.accept_pct != null ? Number(r.accept_pct) : null,
        })),
        totalAccountManagers: totalAms,
        totalAms,
        totalCount: totalAms,
      };
    }

    const payload: DashboardData = {
      kpis: {
        openDemands,
        sourcingShortlist,
        redFlagDemands,
        activeCandidates,
        candidatesDelta,
        interviewsToday,
        interviewsCompletedToday,
        interviewsUpcomingToday,
        nextInterviewToday,
        offersThisMonth,
        offersDelta,
        offersAcceptedThisMonth,
        onboardingsThisMonth,
        pendingOnboardings,
      },
      funnel: { stages: funnelStages, joinedPct },
      demandStatus: { segments: demandStatusSegments, total: demandStatusTotal },
      trend: { months: trendMonths, submissions: trendSubmissions, selections: trendSelections },
      aging,
      interviewActivity,
      attentionRequired,
      sourceEffectiveness,
      companyOverview,
      recruiterPerformance,
      amPerformance,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
