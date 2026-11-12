import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildInterviewReadScope, canEditInterview, interviewEditBlockReason } from '@/lib/auth/interviewPermissions';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { INTERVIEW_CANCELLED_STATUS } from '@/lib/lifecycle/archive';
import { serializeInterview } from '@/lib/serializeInterview';

// GET /api/calendar/interviews?from=&to=&demand_id=&status= — FullCalendar feed, row-filtered
// with the SAME read scope as GET /api/interviews (buildInterviewReadScope) so the calendar can
// never expose an interview the list would hide. Each event also carries `can_manage` /
// `manage_blocked_reason`, computed with the same canEditInterview rule PATCH /api/interviews/[id]
// enforces, so the detail modal's Status/Result/Feedback controls appear only for an interview
// this user may actually change. The calendar is otherwise view-only: it has no create or
// drag-to-reschedule affordance.
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const demandId = searchParams.get('demand_id');
    const status = searchParams.get('status');
    const roundName = searchParams.get('round');

    // Rule: Same central read scope as list so the calendar never exposes a hidden interview.
    const readScope = buildInterviewReadScope({ role: currentUser.role, id: currentUser.userId });
    const where: any = {
      ...readScope,
    };
    if (from || to) {
      where.scheduled_date = {};
      if (from) where.scheduled_date.gte = new Date(from);
      if (to) where.scheduled_date.lte = new Date(to);
    }
    if (demandId) where.demand_id = demandId;
    if (status) {
      where.status = status;
    } else {
      where.status = { not: INTERVIEW_CANCELLED_STATUS };
    }
    if (roundName) where.level = roundName;

    const data = await prisma.interviews.findMany({
      where,
      include: {
        candidates: { select: { full_name: true, email: true, phone: true, source: true } },
        demands: {
          select: {
            request_id: true, skill_description: true, client_name: true,
            created_by: true, contact_profile_id: true, spoc_profile_id: true,
            demand_ta_allocations: { select: { ta_id: true } },
          },
        },
        profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
        submissions: { select: { source: true } },
      },
      orderBy: { scheduled_date: 'asc' },
    });

    // One batched query for the whole feed to learn which schedulers are Recruiters — an
    // Account Manager / Super Admin scheduler means there is no recruiter creator, which is a
    // different situation from a recruiter who has since been unassigned.
    const recruiterRoleIds = await recruiterProfileIds(data.map((iv) => iv.created_by));

    const actor = { role: currentUser.role, id: currentUser.userId };
    const interviews = data.map((iv) => {
      const { demands: demandRow, ...rest } = iv;
      const recruiterIds = demandRow
        ? demandRow.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id)
        : [];
      const creatorIsRecruiter = recruiterRoleIds.has(iv.created_by ?? '');
      const canManage =
        !!demandRow && canEditInterview(actor, demandRow, recruiterIds, iv.created_by, creatorIsRecruiter);
      return {
        ...serializeInterview(rest),
        candidate_name: iv.candidates?.full_name ?? null,
        demand_request_id: demandRow?.request_id ?? null,
        created_by_name: iv.profiles_interviews_created_byToprofiles?.full_name ?? null,
        created_by_email: iv.profiles_interviews_created_byToprofiles?.email ?? null,
        // Source from the pipeline entry (submission) that linked this candidate to this demand.
        // Falls back to the candidate's own source if the pipeline entry has none.
        source: iv.submissions?.source ?? iv.candidates?.source ?? null,
        can_manage: canManage,
        manage_blocked_reason: canManage
          ? null
          : interviewEditBlockReason(actor, recruiterIds, iv.created_by, creatorIsRecruiter),
      };
    });

    return NextResponse.json({ interviews });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/calendar/interviews:', error);
    return NextResponse.json({ interviews: [] }, { status: 500 });
  }
}
