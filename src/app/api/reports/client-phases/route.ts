import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildDashboardDemandCondition } from '@/lib/auth/demandVisibility';
import { PHASE_STATUS_ARRAYS, phasePercentages, toPhaseCounts } from '@/lib/reports/reportPhases';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/reports/client-phases[?companyId=][&includeClosed=true]
 *
 * Report 1 — candidates in each phase (count + %), per client; with `companyId`, the drill-down:
 * the same columns per demand of that client. Closed / cancelled demands are left out unless
 * `includeClosed=true`. Scoped like the dashboard (a Recruiter sees their assigned demands, an AM
 * their own, etc. — buildDashboardDemandCondition).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '';
    if (companyId && companyId !== 'none' && !UUID_RE.test(companyId)) {
      return NextResponse.json({ error: 'Unknown client' }, { status: 400 });
    }
    const includeClosed = searchParams.get('includeClosed') === 'true';

    const conditions: Prisma.Sql[] = [];
    const scope = buildDashboardDemandCondition(user, 'd');
    if (scope) conditions.push(scope);
    if (!includeClosed) conditions.push(Prisma.sql`COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled')`);
    if (companyId === 'none') conditions.push(Prisma.sql`d.company_id IS NULL`);
    else if (companyId) conditions.push(Prisma.sql`d.company_id = ${companyId}::uuid`);
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const { sourcing, shortlist, selection, onboarding } = PHASE_STATUS_ARRAYS;
    const counts = Prisma.sql`
      COUNT(s.id) AS total,
      COUNT(s.id) FILTER (WHERE s.current_status = ANY(${sourcing})) AS sourcing,
      COUNT(s.id) FILTER (WHERE s.current_status = ANY(${shortlist})) AS shortlist,
      COUNT(s.id) FILTER (WHERE s.current_status = ANY(${selection})) AS selection,
      COUNT(s.id) FILTER (WHERE s.current_status = ANY(${onboarding})) AS onboarding,
      COUNT(s.id) FILTER (WHERE s.id IS NOT NULL AND NOT (s.current_status = ANY(${[...sourcing, ...shortlist, ...selection, ...onboarding]}))) AS other`;

    if (companyId) {
      // Drill-down: one row per demand of the client.
      const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT d.id, d.request_id, d.job_title, d.status, COALESCE(d.num_positions, 1) AS positions,
               GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)))::int AS days_open,
               COALESCE(co.client_name, co.name, d.client_name) AS client_name,
               ${counts}
        FROM demands d
        LEFT JOIN companies co ON co.id = d.company_id
        LEFT JOIN submissions s ON s.demand_id = d.id
        ${where}
        GROUP BY d.id, co.client_name, co.name
        ORDER BY d.opened_at DESC`;
      return NextResponse.json({
        level: 'demand',
        client_name: (rows[0]?.client_name as string | undefined) ?? null,
        rows: rows.map((r) => {
          const c = toPhaseCounts(r);
          return {
            id: r.id as string,
            request_id: r.request_id as string,
            job_title: (r.job_title as string | null) ?? null,
            status: (r.status as string | null) ?? null,
            positions: Number(r.positions ?? 1),
            days_open: Number(r.days_open ?? 0),
            counts: c,
            percents: phasePercentages(c),
          };
        }),
      });
    }

    // Top level: one row per client. Positions are summed per demand first, so the candidate join
    // cannot multiply them.
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      WITH per_demand AS (
        SELECT d.id, d.company_id, COALESCE(d.num_positions, 1) AS positions,
               COALESCE(co.client_name, co.name, d.client_name, 'No client') AS client_name,
               ${counts}
        FROM demands d
        LEFT JOIN companies co ON co.id = d.company_id
        LEFT JOIN submissions s ON s.demand_id = d.id
        ${where}
        GROUP BY d.id, co.client_name, co.name
      )
      SELECT company_id, MIN(client_name) AS client_name, COUNT(*) AS demands, SUM(positions) AS positions,
             SUM(total) AS total, SUM(sourcing) AS sourcing, SUM(shortlist) AS shortlist,
             SUM(selection) AS selection, SUM(onboarding) AS onboarding, SUM(other) AS other
      FROM per_demand
      GROUP BY company_id
      ORDER BY SUM(total) DESC, MIN(client_name)`;
    return NextResponse.json({
      level: 'client',
      rows: rows.map((r) => {
        const c = toPhaseCounts(r);
        return {
          company_id: (r.company_id as string | null) ?? 'none',
          client_name: (r.client_name as string) ?? 'No client',
          demands: Number(r.demands ?? 0),
          positions: Number(r.positions ?? 0),
          counts: c,
          percents: phasePercentages(c),
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/reports/client-phases:', error);
    return NextResponse.json({ error: 'Failed to load the report' }, { status: 500 });
  }
}
