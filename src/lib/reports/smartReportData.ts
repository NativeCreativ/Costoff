import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { SessionPayload } from '@/lib/auth/jwt';
import { buildDashboardDemandCondition } from '@/lib/auth/demandVisibility';
import { computePhaseAging } from '@/lib/candidates/phaseAging';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';

/**
 * Smart Reports (review of 18 Nov 2026, item 12): the data snapshot the AI answers from.
 *
 * - Scoped exactly like the dashboard (buildDashboardDemandCondition), so a user can only ask
 *   about demands they could already see in the app.
 * - Aggregates and demand-level facts only. No candidate names, phones, emails, PAN or CTCs leave
 *   the server; pipeline entries are referred to by demand ID, phase and days.
 * - Kept small (limits below) so a question stays fast and cheap.
 */
const DEMAND_LIMIT = 150;
const WAIT_LIMIT = 25;

export interface SmartReportSnapshot {
  today: string;
  viewer_role: string;
  demands: Record<string, unknown>[];
  pipeline_status_totals: Record<string, number>;
  interviews_by_day: { day: string; status: string; count: number }[];
  aging_by_phase: Record<string, { candidates: number; avg_days: number; max_days: number }>;
  longest_waits: { request_id: string; client: string | null; phase: string | null; days_in_phase: number }[];
  team_activity_last_30_days: { name: string; role: string; calls: number; profiles_added: number }[] | 'only Delivery Head sees team activity';
}

export async function buildSmartReportSnapshot(user: SessionPayload): Promise<SmartReportSnapshot> {
  const today = todayInIndia();
  const scope = buildDashboardDemandCondition(user, 'd');
  const where = scope ? Prisma.sql`WHERE ${scope}` : Prisma.empty;
  const andScope = scope ? Prisma.sql`AND ${scope}` : Prisma.empty;

  const [demands, statusTotals, interviews, activeSubs] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT d.request_id, COALESCE(co.client_name, co.name, d.client_name) AS client, d.job_title, d.status,
             d.priority, COALESCE(d.num_positions, 1) AS positions, d.is_niche,
             GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)))::int AS days_open,
             (SELECT COUNT(*) FROM submissions s WHERE s.demand_id = d.id AND s.is_active)::int AS active_candidates,
             (SELECT COUNT(*) FROM submissions s WHERE s.demand_id = d.id AND s.current_status IN ('selected','offer_released','offer_accepted','onboarding','bgv_pending','bgv_verified','joined'))::int AS selected_or_later,
             (SELECT COUNT(*) FROM submissions s WHERE s.demand_id = d.id AND s.current_status = 'joined')::int AS joined
      FROM demands d
      LEFT JOIN companies co ON co.id = d.company_id
      ${where}
      ORDER BY (COALESCE(d.status, '') IN ('Closure', 'Cancelled')), d.opened_at DESC
      LIMIT ${DEMAND_LIMIT}`,
    prisma.$queryRaw<{ current_status: string; count: bigint }[]>`
      SELECT s.current_status, COUNT(*) AS count
      FROM submissions s JOIN demands d ON d.id = s.demand_id
      WHERE s.is_active ${andScope}
      GROUP BY s.current_status`,
    prisma.$queryRaw<{ day: string; status: string | null; count: bigint }[]>`
      SELECT to_char(i.scheduled_date, 'YYYY-MM-DD') AS day, i.status, COUNT(*) AS count
      FROM interviews i JOIN demands d ON d.id = i.demand_id
      WHERE i.scheduled_date BETWEEN (${today}::date - 30) AND (${today}::date + 14) ${andScope}
      GROUP BY 1, 2
      ORDER BY 1`,
    prisma.$queryRaw<{ id: string; created_at: Date; current_status: string; request_id: string; client: string | null }[]>`
      SELECT s.id, s.created_at, s.current_status, d.request_id, COALESCE(co.client_name, co.name, d.client_name) AS client
      FROM submissions s JOIN demands d ON d.id = s.demand_id
      LEFT JOIN companies co ON co.id = d.company_id
      WHERE s.is_active AND COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled') ${andScope}
      ORDER BY s.created_at ASC
      LIMIT 1000`,
  ]);

  // Aging per phase from the status events of the active pipeline entries.
  const events = activeSubs.length
    ? await prisma.submission_events.findMany({
        where: { submission_id: { in: activeSubs.map((s) => s.id) }, event_type: 'status_change' },
        select: { submission_id: true, to_status: true, created_at: true },
      })
    : [];
  const bySub = new Map<string, { to_status: string | null; created_at: Date }[]>();
  for (const e of events) bySub.set(e.submission_id, [...(bySub.get(e.submission_id) ?? []), e]);
  const waits = activeSubs.map((s) => {
    const aging = computePhaseAging({ created_at: s.created_at, current_status: s.current_status, events: bySub.get(s.id) ?? [] });
    return { request_id: s.request_id, client: s.client, phase: aging.current_phase, days_in_phase: aging.days_in_current_phase ?? 0 };
  });
  const agingByPhase: SmartReportSnapshot['aging_by_phase'] = {};
  for (const w of waits) {
    if (!w.phase) continue;
    const a = (agingByPhase[w.phase] ??= { candidates: 0, avg_days: 0, max_days: 0 });
    a.avg_days = (a.avg_days * a.candidates + w.days_in_phase) / (a.candidates + 1);
    a.candidates += 1;
    a.max_days = Math.max(a.max_days, w.days_in_phase);
  }
  for (const a of Object.values(agingByPhase)) a.avg_days = Math.round(a.avg_days * 10) / 10;

  // Team activity: Delivery Head only (same rule as the Team Contribution report).
  let team: SmartReportSnapshot['team_activity_last_30_days'] = 'only Delivery Head sees team activity';
  if (user.role === 'super_admin') {
    const rows = await prisma.$queryRaw<{ name: string; role: string; calls: bigint; profiles_added: bigint }[]>`
      SELECT p.full_name AS name, p.role,
             (SELECT COUNT(*) FROM demand_call_logs c WHERE c.created_by = p.id AND c.created_at >= NOW() - INTERVAL '30 days') AS calls,
             (SELECT COUNT(*) FROM submissions s WHERE s.added_by = p.id AND s.created_at >= NOW() - INTERVAL '30 days') AS profiles_added
      FROM profiles p
      WHERE p.role IN ('ta', 'account_manager', 'spoc')`;
    team = rows
      .map((r) => ({ name: r.name, role: r.role, calls: Number(r.calls), profiles_added: Number(r.profiles_added) }))
      .filter((r) => r.calls > 0 || r.profiles_added > 0);
  }

  return {
    today,
    viewer_role: user.role,
    demands,
    pipeline_status_totals: Object.fromEntries(statusTotals.map((r) => [r.current_status, Number(r.count)])),
    interviews_by_day: interviews.map((r) => ({ day: r.day, status: r.status ?? 'Unknown', count: Number(r.count) })),
    aging_by_phase: agingByPhase,
    longest_waits: waits.sort((a, b) => b.days_in_phase - a.days_in_phase).slice(0, WAIT_LIMIT),
    team_activity_last_30_days: team,
  };
}
