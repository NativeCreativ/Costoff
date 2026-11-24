import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildDashboardDemandCondition } from '@/lib/auth/demandVisibility';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/reports/todays-interviews[?date=YYYY-MM-DD][&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD][&activeOnly=true]
 *
 * Report 2 (Review Comments 16 & 17) — interviews in the date range with their CURRENT status,
 * per-day breakdown, and per-status summary for drill-down. Optional activeOnly filter scopes
 * to active (non-closed/cancelled) demands.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawDate = searchParams.get('date') || '';
    const rawStartDate = searchParams.get('startDate') || '';
    const rawEndDate = searchParams.get('endDate') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true' || searchParams.get('activeDemandsOnly') === 'true';

    const startDate = ISO_DATE.test(rawStartDate) ? rawStartDate : null;
    const endDate = ISO_DATE.test(rawEndDate) ? rawEndDate : null;
    const singleDate = ISO_DATE.test(rawDate) ? rawDate : todayInIndia();

    const conditions: Prisma.Sql[] = [];

    if (startDate && endDate) {
      conditions.push(Prisma.sql`i.scheduled_date >= ${startDate}::date AND i.scheduled_date <= ${endDate}::date`);
    } else if (startDate) {
      conditions.push(Prisma.sql`i.scheduled_date >= ${startDate}::date`);
    } else {
      conditions.push(Prisma.sql`i.scheduled_date = ${singleDate}::date`);
    }

    if (activeOnly) {
      conditions.push(Prisma.sql`COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled')`);
    }

    const scope = buildDashboardDemandCondition(user, 'd');
    if (scope) conditions.push(scope);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT i.id, COALESCE(i.status, 'Scheduled') AS status, i.result,
             to_char(i.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
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
      ORDER BY i.scheduled_date ASC, i.scheduled_time NULLS LAST, c.full_name`;

    const interviews = rows.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      result: (r.result as string | null) ?? null,
      scheduled_date: (r.scheduled_date as string | null) ?? null,
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

    // Group counts per day for date-range drilldown
    const byDayMap = new Map<string, typeof interviews>();
    for (const iv of interviews) {
      const d = iv.scheduled_date || singleDate;
      if (!byDayMap.has(d)) byDayMap.set(d, []);
      byDayMap.get(d)!.push(iv);
    }
    const dailyCounts = [...byDayMap.entries()].map(([day, ivs]) => {
      const dayStatusCounts = new Map<string, number>();
      for (const iv of ivs) dayStatusCounts.set(iv.status, (dayStatusCounts.get(iv.status) ?? 0) + 1);
      return {
        date: day,
        count: ivs.length,
        byStatus: Object.fromEntries(dayStatusCounts),
      };
    });

    return NextResponse.json({
      date: singleDate,
      startDate: startDate ?? singleDate,
      endDate: endDate ?? singleDate,
      activeOnly,
      total: interviews.length,
      dailyCounts,
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
