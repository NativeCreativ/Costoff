import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canManageDemandPipeline, canUploadProfilesToDemand } from '@/lib/auth/demandFulfillmentPermissions';
import { DEMANDS_WITH_AGING_BASE } from '@/lib/demands/demandAgingQuery';

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // 1. Fetch the demand (with aging/am/spoc/compensation/recruiter enrichment) —
    // try by request_id first, then by uuid. Both read straight off the `demands` base
    // table (via DEMANDS_WITH_AGING_BASE), so — unlike the removed view — this always
    // finds the row when it exists; no base-table fallback is needed anymore.
    let demandRows: any[] = await prisma.$queryRaw`
      SELECT * FROM (${DEMANDS_WITH_AGING_BASE}) v
      WHERE request_id = ${requestId}
      LIMIT 1
    `;

    if ((!demandRows || demandRows.length === 0) && requestId.length === 36) {
      demandRows = await prisma.$queryRaw`
        SELECT * FROM (${DEMANDS_WITH_AGING_BASE}) v
        WHERE id = ${requestId}::uuid
        LIMIT 1
      `;
    }

    if (!demandRows || demandRows.length === 0) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }

    // Compensation bounds are free text (VARCHAR) — passed through as-is, never parsed.
    const demand: any = {
      ...demandRows[0],
      compensation_min: demandRows[0].compensation_min ?? null,
      compensation_max: demandRows[0].compensation_max ?? null,
    };

    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, { contact_profile_id: demand.contact_profile_id, spoc_profile_id: demand.spoc_profile_id, recruiterIds: demand.recruiter_ids })) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const demandUuid: string | null = demand.id ?? null;

    // am_name/spoc_name come straight from DEMANDS_WITH_AGING_BASE, resolved off
    // contact_profile_id (AM-only) and spoc_profile_id (SPOC-only) independently —
    // no extra lookup needed. am_role is kept for older callers that still read it.
    if (demand.contact_profile_id) {
      demand.am_role = 'account_manager';
    }

    // 2. Fetch submissions + candidate details for this demand
    let submissions: any[] = [];
    if (demandUuid) {
      try {
        const subs = await prisma.submissions.findMany({
          where: { demand_id: demandUuid },
          include: { candidates: true },
          orderBy: { created_at: 'desc' },
        });
        submissions = subs.map(s => ({
          ...s,
          candidates: s.candidates
            ? {
                ...s.candidates,
                current_ctc: toNum(s.candidates.current_ctc),
                expected_ctc: toNum(s.candidates.expected_ctc),
              }
            : null,
        }));
      } catch (e) {
        console.warn('Submissions fetch warning:', e);
      }
    }

    // 3. Fetch interviews for this demand (by demand_id uuid)
    let interviews: any[] = [];
    if (demandUuid) {
      try {
        interviews = await prisma.interviews.findMany({
          where: { demand_id: demandUuid },
          orderBy: { scheduled_date: 'asc' },
          include: {
            profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
          },
        });
      } catch (e) {
        console.warn('Interviews fetch warning:', e);
      }
    }

    // 4. Fetch offers + candidate info for this demand
    let offers: any[] = [];
    if (demandUuid) {
      try {
        const offersData = await prisma.offers.findMany({
          where: { demand_id: demandUuid },
          include: {
            candidates: {
              select: { full_name: true, email: true, phone: true },
            },
          },
        });
        offers = offersData.map(o => ({
          ...o,
          offered_ctc: toNum(o.offered_ctc),
        }));
      } catch (e) {
        console.warn('Offers fetch warning:', e);
      }
    }

    // 5. Fetch onboardings + candidate info for this demand
    let onboardings: any[] = [];
    if (demandUuid) {
      try {
        onboardings = await prisma.onboardings.findMany({
          where: { demand_id: demandUuid },
          include: {
            candidates: {
              select: { full_name: true, email: true, phone: true },
            },
          },
        });
      } catch (e) {
        console.warn('Onboardings fetch warning:', e);
      }
    }

    let clientSpocs: { id: string; name: string; email: string | null; phone: string | null }[] = [];
    let assignmentEvents: { id: string; category: string; action: string; subject_id: string | null; subject_label: string | null; created_at: Date }[] = [];
    if (demand.company_id) {
      clientSpocs = await prisma.company_spocs.findMany({
        where: { company_id: demand.company_id },
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, email: true, phone: true },
      });
    }
    if (demandUuid) {
      const rows = await prisma.demand_assignment_events.findMany({
        where: { demand_id: demandUuid },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
      const ids = rows.map((row) => row.subject_id).filter((id): id is string => !!id);
      const [people, spocs] = await Promise.all([
        ids.length ? prisma.profiles.findMany({ where: { id: { in: ids } }, select: { id: true, full_name: true } }) : [],
        ids.length ? prisma.company_spocs.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [],
      ]);
      const names = new Map<string, string>([
        ...people.map((person) => [person.id, person.full_name] as const),
        ...spocs.map((spoc) => [spoc.id, spoc.name] as const),
      ]);
      assignmentEvents = rows.map((row) => ({
        ...row,
        subject_label: row.subject_label || (row.subject_id ? names.get(row.subject_id) || null : null),
      }));
    }

    return NextResponse.json({
      success: true,
      demand,
      submissions,
      interviews,
      offers,
      onboardings,
      clientSpocs,
      assignmentEvents,
      // Whether the viewer may change this demand's pipeline / assign candidates / change a
      // submission stage. Same predicate PUT/POST /api/submissions enforce, computed here so the
      // drawer's controls reflect the API instead of relying on the client to re-derive a role
      // check. Read-only roles (SPOC / hr / viewer) get false and the UI renders no controls.
      can_manage_pipeline: canManageDemandPipeline(
        { role: currentUser.role, id: currentUser.userId },
        { created_by: demand.created_by, contact_profile_id: demand.contact_profile_id, spoc_profile_id: demand.spoc_profile_id },
        demand.recruiter_ids ?? [],
      ),
      // Narrower question: may the viewer ADD a profile? True for any Recruiter even when not
      // assigned (canUploadProfilesToDemand), so the Pipeline shows "Add Candidate" to them
      // while every other pipeline control stays behind can_manage_pipeline.
      can_upload_profiles: canUploadProfilesToDemand(
        { role: currentUser.role, id: currentUser.userId },
        { created_by: demand.created_by, contact_profile_id: demand.contact_profile_id, spoc_profile_id: demand.spoc_profile_id },
        demand.recruiter_ids ?? [],
      ),
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in /api/demands/[requestId]/lifecycle:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
