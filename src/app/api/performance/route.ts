import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { RECRUITER_PROFILE_ROLE } from '@/lib/demandFulfillment/constants';

/**
 * GET /api/performance — the four Performance & Analytics report pages.
 *
 * Every metric is computed from a real query. The previous version of
 * this route filled candidate counts, submissions, interviews, client
 * analytics and the global KPIs with Math.random() values and
 * hardcoded numbers; all of that is gone. Metrics the database cannot
 * support (recruiter submission targets, TAT windows with no events,
 * acceptance rates with no offers) are returned as null — never as an
 * invented number — and the report pages render them blank.
 *
 * The response shape is unchanged so the existing report pages
 * (/performance/recruiters, /performance/account-managers,
 * /performance/client-analytics, /performance/global-kpis) keep working.
 */

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
    const [taRows, amRows, clientRows, globalRows] = await Promise.all([
      // Recruiter (TA) metrics — real submitter/scheduler data only.
      prisma.$queryRaw<{
        id: string; full_name: string; role: string;
        demands_worked: number; candidates_scoped: number;
        submissions: number; interviews_scheduled: number; selections: number;
      }[]>`
        SELECT p.id, p.full_name, p.role,
          (SELECT COUNT(DISTINCT dta.demand_id)
             FROM demand_ta_allocations dta
            WHERE dta.ta_id = p.id)::int AS demands_worked,
          (SELECT COUNT(DISTINCT s.candidate_id)
             FROM submissions s
             JOIN demand_ta_allocations dta ON dta.demand_id = s.demand_id
            WHERE dta.ta_id = p.id AND s.candidate_id IS NOT NULL)::int AS candidates_scoped,
          (SELECT COUNT(*) FROM submissions s
            WHERE s.submitted_by_ta = p.id)::int AS submissions,
          (SELECT COUNT(*) FROM interviews i
            WHERE i.created_by = p.id)::int AS interviews_scheduled,
          (SELECT COUNT(*) FROM submissions s
            WHERE s.submitted_by_ta = p.id AND s.current_status = 'selected')::int AS selections
        FROM profiles p
        WHERE p.role = ${RECRUITER_PROFILE_ROLE}
        ORDER BY p.full_name ASC
      `,
      // Account Manager metrics. TAT windows are averaged over the real
      // events that exist (demand_assignments for intake→allocation,
      // submission_events for submission→client); an AM with no such
      // events gets null, not a fabricated number.
      prisma.$queryRaw<{
        id: string; full_name: string;
        open_demands_managed: number;
        intake_to_allocation_days: number | null;
        submission_to_client_days: number | null;
        total_offers: number; accepted_offers: number;
      }[]>`
        SELECT p.id, p.full_name,
          (SELECT COUNT(*) FROM demands d
            WHERE d.contact_profile_id = p.id
              AND d.status NOT IN ('Closure', 'Cancelled'))::int AS open_demands_managed,
          (SELECT AVG(EXTRACT(EPOCH FROM (da.assigned_at - d.opened_at)) / 86400)
             FROM demand_assignments da
             JOIN demands d ON d.id = da.demand_id
            WHERE da.role_in_demand = 'account_manager'
              AND da.user_id = p.id
              AND da.assigned_at IS NOT NULL) AS intake_to_allocation_days,
          (SELECT AVG(EXTRACT(EPOCH FROM (se.created_at - s.created_at)) / 86400)
             FROM submission_events se
             JOIN submissions s ON s.id = se.submission_id
            WHERE se.event_type = 'status_change'
              AND se.to_status = 'sent_to_customer'
              AND s.managed_by_am = p.id) AS submission_to_client_days,
          (SELECT COUNT(*) FROM offers o
             JOIN demands d ON d.id = o.demand_id
            WHERE d.contact_profile_id = p.id)::int AS total_offers,
          (SELECT COUNT(*) FROM offers o
             JOIN demands d ON d.id = o.demand_id
            WHERE d.contact_profile_id = p.id AND o.status = 'Accepted')::int AS accepted_offers
        FROM profiles p
        WHERE p.role = 'account_manager'
        ORDER BY p.full_name ASC
      `,
      // Client (Company) analytics — grouped by the Company master the
      // demand actually belongs to (demands.company_id → companies).
      prisma.$queryRaw<{
        id: string; name: string;
        total_demands: number; open_demands: number;
        submissions: number; interviews: number; offers: number; joins: number;
      }[]>`
        SELECT co.id, co.name,
          (SELECT COUNT(*) FROM demands d WHERE d.company_id = co.id)::int AS total_demands,
          (SELECT COUNT(*) FROM demands d
            WHERE d.company_id = co.id AND d.status NOT IN ('Closure', 'Cancelled'))::int AS open_demands,
          (SELECT COUNT(*) FROM submissions s
            JOIN demands d ON d.id = s.demand_id
            WHERE d.company_id = co.id)::int AS submissions,
          (SELECT COUNT(*) FROM interviews i
            JOIN demands d ON d.id = i.demand_id
            WHERE d.company_id = co.id)::int AS interviews,
          (SELECT COUNT(*) FROM offers o
            JOIN demands d ON d.id = o.demand_id
            WHERE d.company_id = co.id)::int AS offers,
          (SELECT COUNT(*) FROM onboardings ob
            JOIN demands d ON d.id = ob.demand_id
            WHERE d.company_id = co.id AND ob.status = 'onboarded')::int AS joins
        FROM companies co
        ORDER BY co.name ASC
      `,
      // Global KPIs. Each is averaged/counted over real events only.
      prisma.$queryRaw<{
        avg_time_to_fill_days: number | null;
        avg_time_to_hire_days: number | null;
        total_offers: number; accepted_offers: number;
        attended_interviews: number; no_show_interviews: number;
      }[]>`
        SELECT
          (SELECT AVG(EXTRACT(EPOCH FROM (d.closed_at - d.opened_at)) / 86400)
             FROM demands d
            WHERE d.status = 'Closure' AND d.closed_at IS NOT NULL) AS avg_time_to_fill_days,
          (SELECT AVG(EXTRACT(EPOCH FROM (se.created_at - s.created_at)) / 86400)
             FROM submission_events se
             JOIN submissions s ON s.id = se.submission_id
            WHERE se.event_type = 'status_change' AND se.to_status = 'joined') AS avg_time_to_hire_days,
          (SELECT COUNT(*) FROM offers)::int AS total_offers,
          (SELECT COUNT(*) FROM offers WHERE status = 'Accepted')::int AS accepted_offers,
          (SELECT COUNT(*) FROM interviews WHERE status = 'Completed')::int AS attended_interviews,
          (SELECT COUNT(*) FROM interviews WHERE status IN ('Candidate No-Show', 'Client No-Show'))::int AS no_show_interviews
      `,
    ]);

    const taMetrics = taRows.map((r) => ({
      id: r.id,
      name: r.full_name,
      role: r.role,
      demandsWorked: Number(r.demands_worked),
      candidatesScoped: Number(r.candidates_scoped),
      submissions: Number(r.submissions),
      // No submission-target data exists anywhere in the database —
      // these are null, not invented.
      targetDaily: null,
      targetAchievedPct: null,
      interviewsScheduled: Number(r.interviews_scheduled),
      selections: Number(r.selections),
    }));

    const amMetrics = amRows.map((r) => ({
      id: r.id,
      name: r.full_name,
      intakeToAllocationDays:
        r.intake_to_allocation_days == null ? null : Math.round(Number(r.intake_to_allocation_days) * 10) / 10,
      submissionToClientDays:
        r.submission_to_client_days == null ? null : Math.round(Number(r.submission_to_client_days) * 10) / 10,
      offerAcceptanceRate:
        Number(r.total_offers) > 0
          ? Math.round((Number(r.accepted_offers) / Number(r.total_offers)) * 100)
          : null,
      openDemandsManaged: Number(r.open_demands_managed),
    }));

    const clientMetrics = clientRows.map((r) => ({
      id: r.id,
      clientName: r.name,
      totalDemands: Number(r.total_demands),
      openDemands: Number(r.open_demands),
      submissions: Number(r.submissions),
      interviews: Number(r.interviews),
      offers: Number(r.offers),
      joins: Number(r.joins),
    }));

    const g = globalRows[0];
    const totalOffers = Number(g?.total_offers ?? 0);
    const acceptedOffers = Number(g?.accepted_offers ?? 0);
    const attended = Number(g?.attended_interviews ?? 0);
    const noShows = Number(g?.no_show_interviews ?? 0);
    const globalKpis = {
      avgTimeToFillDays: g?.avg_time_to_fill_days == null ? null : Math.round(Number(g.avg_time_to_fill_days) * 10) / 10,
      avgTimeToHireDays: g?.avg_time_to_hire_days == null ? null : Math.round(Number(g.avg_time_to_hire_days) * 10) / 10,
      offerAcceptanceRatePct: totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : null,
      interviewAttendanceRatePct: attended + noShows > 0 ? Math.round((attended / (attended + noShows)) * 100) : null,
    };

    return NextResponse.json({ taMetrics, amMetrics, clientMetrics, globalKpis });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 },
    );
  }
}
