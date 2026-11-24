import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildDashboardDemandCondition } from '@/lib/auth/demandVisibility';
import { computePhaseAging } from '@/lib/candidates/phaseAging';
import { LIFECYCLE_PHASE_STATUSES } from '@/lib/demandFulfillment/lifecyclePhases';

const ROW_LIMIT = 500;
const PHASES = Object.keys(LIFECYCLE_PHASE_STATUSES);

/**
 * GET /api/reports/candidate-aging[?phase=sourcing|shortlist|selection|onboarding]
 *
 * Candidate aging (review batch 5): every active pipeline entry on open demands, with the days
 * spent in its current phase and in each earlier one — longest wait first. Scoped like the
 * dashboard (buildDashboardDemandCondition: a Recruiter sees their assigned demands, etc.).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get('phase') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true' || searchParams.get('activeDemandsOnly') === 'true';
    if (phase && !PHASES.includes(phase)) return NextResponse.json({ error: 'Unknown phase' }, { status: 400 });
    const statuses = phase
      ? [...(LIFECYCLE_PHASE_STATUSES[phase as keyof typeof LIFECYCLE_PHASE_STATUSES] as readonly string[])]
      : PHASES.flatMap((p) => [...(LIFECYCLE_PHASE_STATUSES[p as keyof typeof LIFECYCLE_PHASE_STATUSES] as readonly string[])]);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.is_active = true`,
      Prisma.sql`s.current_status = ANY(${statuses})`,
      activeOnly
        ? Prisma.sql`COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled', 'On Hold')`
        : Prisma.sql`COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled')`,
    ];
    const scope = buildDashboardDemandCondition(user, 'd');
    if (scope) conditions.push(scope);

    const rows = await prisma.$queryRaw<
      { id: string; created_at: Date; current_status: string; candidate_id: string; full_name: string; request_id: string; job_title: string | null; client_name: string | null }[]
    >`
      SELECT s.id, s.created_at, s.current_status, c.id AS candidate_id, c.full_name, d.request_id, d.job_title,
             COALESCE(co.client_name, co.name, d.client_name) AS client_name
      FROM submissions s
      JOIN demands d ON d.id = s.demand_id
      JOIN candidates c ON c.id = s.candidate_id
      LEFT JOIN companies co ON co.id = d.company_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY s.created_at ASC
      LIMIT ${ROW_LIMIT * 4}`;

    const events = rows.length
      ? await prisma.submission_events.findMany({
          where: { submission_id: { in: rows.map((r) => r.id) }, event_type: 'status_change' },
          select: { submission_id: true, to_status: true, created_at: true },
        })
      : [];
    const bySubmission = new Map<string, { to_status: string | null; created_at: Date }[]>();
    for (const e of events) bySubmission.set(e.submission_id, [...(bySubmission.get(e.submission_id) ?? []), e]);

    const out = rows
      .map((r) => {
        const aging = computePhaseAging({ created_at: r.created_at, current_status: r.current_status, events: bySubmission.get(r.id) ?? [] });
        return {
          submission_id: r.id,
          candidate_id: r.candidate_id,
          candidate_name: r.full_name,
          request_id: r.request_id,
          job_title: r.job_title,
          client_name: r.client_name,
          status: r.current_status,
          current_phase: aging.current_phase,
          days_in_current_phase: aging.days_in_current_phase ?? 0,
          days_by_phase: aging.days_by_phase,
        };
      })
      .sort((a, b) => b.days_in_current_phase - a.days_in_current_phase)
      .slice(0, ROW_LIMIT);

    return NextResponse.json({ phase: phase || null, rows: out, truncated: rows.length > ROW_LIMIT });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/reports/candidate-aging:', error);
    return NextResponse.json({ error: 'Failed to load the report' }, { status: 500 });
  }
}
