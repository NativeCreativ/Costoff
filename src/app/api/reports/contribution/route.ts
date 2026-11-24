import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';
import {
  CONTRIBUTION_MAX_DAYS,
  CONTRIBUTION_METRICS,
  STATUS_METRIC,
  canSeeEveryonesContribution,
  type ContributionMetric,
} from '@/lib/reports/contribution';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/reports/contribution?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=<uuid>]
 *
 * Without userId: one row per person with activity in the range (India dates, inclusive). With
 * userId: that person's numbers per demand (the drill-down). Super Admin sees everyone; anyone
 * else only themselves (userId is forced to the viewer).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true' || searchParams.get('activeDemandsOnly') === 'true';
    const today = todayInIndia();
    const from = searchParams.get('from') || `${today.slice(0, 8)}01`;
    const to = searchParams.get('to') || today;
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      return NextResponse.json({ error: 'Pick a valid date range' }, { status: 400 });
    }
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > CONTRIBUTION_MAX_DAYS) {
      return NextResponse.json({ error: 'Pick a range of one year or less' }, { status: 400 });
    }
    const seeAll = canSeeEveryonesContribution(user.role);
    let userId = searchParams.get('userId') || '';
    if (userId && !UUID_RE.test(userId)) return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
    if (!seeAll) userId = user.userId;

    // India-day boundaries as timestamps.
    const start = Prisma.sql`((${from}::date)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
    const end = Prisma.sql`(((${to}::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata')`;
    const statuses = Object.keys(STATUS_METRIC);
    const statusCase = Prisma.join(
      Object.entries(STATUS_METRIC).map(([status, metric]) => Prisma.sql`WHEN ${status} THEN ${metric}`),
      ' '
    );

    const activity = Prisma.sql`
      SELECT created_by AS user_id, demand_id, 'calls'::text AS metric FROM demand_call_logs
        WHERE created_at >= ${start} AND created_at < ${end}
      UNION ALL
      SELECT created_by, demand_id, 'demand_matches' FROM demand_call_logs
        WHERE outcome = 'demand_match' AND created_at >= ${start} AND created_at < ${end}
      UNION ALL
      SELECT added_by, demand_id, 'profiles_added' FROM submissions
        WHERE created_at >= ${start} AND created_at < ${end}
      UNION ALL
      SELECT e.created_by, s.demand_id, (CASE e.to_status ${statusCase} END)::text
        FROM submission_events e JOIN submissions s ON s.id = e.submission_id
        WHERE e.event_type = 'status_change' AND e.to_status = ANY(${statuses})
          AND e.created_at >= ${start} AND e.created_at < ${end}
      UNION ALL
      SELECT created_by, demand_id, 'interviews_scheduled' FROM interviews
        WHERE created_at >= ${start} AND created_at < ${end}`;

    const counts = Prisma.join(
      CONTRIBUTION_METRICS.map((m) => Prisma.sql`COUNT(*) FILTER (WHERE a.metric = ${m}) AS ${Prisma.raw(`"${m}"`)}`),
      ', '
    );
    const toCounts = (r: Record<string, unknown>) =>
      Object.fromEntries(CONTRIBUTION_METRICS.map((m) => [m, Number(r[m] ?? 0)])) as Record<ContributionMetric, number>;

    if (userId) {
      const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT d.id AS demand_id, d.request_id, d.job_title, COALESCE(co.client_name, co.name, d.client_name) AS client_name, ${counts}
        FROM (${activity}) a
        JOIN demands d ON d.id = a.demand_id
        LEFT JOIN companies co ON co.id = d.company_id
        WHERE a.user_id = ${userId}::uuid ${activeOnly ? Prisma.sql`AND COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled')` : Prisma.empty}
        GROUP BY d.id, d.request_id, d.job_title, co.client_name, co.name, d.client_name
        ORDER BY COUNT(*) DESC, d.request_id`;
      const person = await prisma.profiles.findUnique({ where: { id: userId }, select: { full_name: true, role: true } });
      return NextResponse.json({
        level: 'demand',
        from,
        to,
        activeOnly,
        user: { id: userId, name: person?.full_name ?? 'Unknown', role: person?.role ?? null },
        can_see_all: seeAll,
        rows: rows.map((r) => ({
          demand_id: r.demand_id as string,
          request_id: r.request_id as string,
          job_title: (r.job_title as string | null) ?? null,
          client_name: (r.client_name as string | null) ?? null,
          counts: toCounts(r),
        })),
      });
    }

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT p.id AS user_id, p.full_name, p.role, ${counts}
      FROM (${activity}) a
      ${activeOnly ? Prisma.sql`JOIN demands d ON d.id = a.demand_id AND COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled')` : Prisma.empty}
      JOIN profiles p ON p.id = a.user_id
      GROUP BY p.id, p.full_name, p.role
      ORDER BY COUNT(*) DESC, p.full_name`;
    return NextResponse.json({
      level: 'user',
      from,
      to,
      activeOnly,
      can_see_all: true,
      rows: rows.map((r) => ({ user_id: r.user_id as string, name: r.full_name as string, role: r.role as string, counts: toCounts(r) })),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/reports/contribution:', error);
    return NextResponse.json({ error: 'Failed to load the report' }, { status: 500 });
  }
}
