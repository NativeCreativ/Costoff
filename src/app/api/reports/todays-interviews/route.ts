import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildDashboardDemandCondition } from '@/lib/auth/demandVisibility';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/reports/todays-interviews[?date=YYYY-MM-DD]
 *
 * Report 2 — the day's interviews (default: today, India time) with their CURRENT status, plus
 * a per-status summary for the drill-down. View only. Same demand scope as the dashboard.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const raw = new URL(request.url).searchParams.get('date') || '';
    const date = ISO_DATE.test(raw) ? raw : todayInIndia();

    const conditions: Prisma.Sql[] = [Prisma.sql`i.scheduled_date = ${date}::date`];
    const scope = buildDashboardDemandCondition(user, 'd');
    if (scope) conditions.push(scope);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT i.id, COALESCE(i.status, 'Scheduled') AS status, i.result,
             to_char(i.scheduled_time, 'HH24:MI') AS start_time, to_char(i.end_time, 'HH24:MI') AS end_time,
             i.interview_type, i.mode, i.interview_location,
             COALESCE(r.name, i.level) AS round_name,
             c.full_name AS candidate_name,
             d.request_id, d.job_title,
             COALESCE(co.client_name, co.name, d.client_name) AS client_name
      FROM interviews i
      JOIN demands d ON d.id = i.demand_id
      LEFT JOIN candidates c ON c.id = i.candidate_id
      LEFT JOIN demand_interview_rounds r ON r.id = i.round_id
      LEFT JOIN companies co ON co.id = d.company_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY i.scheduled_time NULLS LAST, c.full_name`;

    const interviews = rows.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      result: (r.result as string | null) ?? null,
      start_time: (r.start_time as string | null) ?? null,
      end_time: (r.end_time as string | null) ?? null,
      interview_type: (r.interview_type as string | null) ?? null,
      mode: (r.mode as string | null) ?? null,
      interview_location: (r.interview_location as string | null) ?? null,
      round_name: (r.round_name as string | null) ?? null,
      candidate_name: (r.candidate_name as string | null) ?? null,
      request_id: r.request_id as string,
      job_title: (r.job_title as string | null) ?? null,
      client_name: (r.client_name as string | null) ?? null,
    }));
    const byStatus = new Map<string, number>();
    for (const iv of interviews) byStatus.set(iv.status, (byStatus.get(iv.status) ?? 0) + 1);

    return NextResponse.json({
      date,
      total: interviews.length,
      summary: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      interviews,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/reports/todays-interviews:', error);
    return NextResponse.json({ error: 'Failed to load the report' }, { status: 500 });
  }
}
