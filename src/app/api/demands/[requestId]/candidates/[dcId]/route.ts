import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { canEditAsRecordCreator, creatorEditBlockMessage } from '@/lib/auth/creatorScope';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { serializeInterview } from '@/lib/serializeInterview';

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// GET /api/demands/[requestId]/candidates/[dcId] — full detail + event timeline + interviews +
// onboarding + this candidate's history in other demands.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string; dcId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { requestId, dcId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }
    const demandId = demand.id;

    const submission = await prisma.submissions.findFirst({
      where: { id: dcId, demand_id: demandId },
      include: {
        candidates: true,
        demands: { select: { request_id: true, skill_description: true, client_name: true, company_name: true } },
        profiles_submissions_added_byToprofiles: { select: { id: true, full_name: true } },
        onboardings: true,
      },
    });
    if (!submission) {
      return NextResponse.json({ error: 'Candidate not found in this demand' }, { status: 404 });
    }

    const [events, interviews, otherDemands] = await Promise.all([
      prisma.submission_events.findMany({
        where: { submission_id: dcId },
        include: { profiles: { select: { id: true, full_name: true, role: true } } },
        orderBy: { created_at: 'asc' },
      }),
      prisma.interviews.findMany({
        where: { submission_id: dcId },
        include: {
          profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
        },
        orderBy: { scheduled_date: 'asc' },
      }),
      prisma.submissions.findMany({
        where: { candidate_id: submission.candidate_id ?? undefined, demand_id: { not: demandId } },
        select: {
          demand_id: true,
          current_status: true,
          is_active: true,
          final_result: true,
          created_at: true,
          demands: { select: { request_id: true, skill_description: true, company_name: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Per-actor flags so the panel can DISABLE (not hide) the pipeline actions it would
    // otherwise render. Both go through the same canEditAsRecordCreator decision the
    // mutating routes use — the candidate row keyed on submissions.added_by, each
    // interview on interviews.created_by — so a control is never enabled for an action
    // the API would reject.
    const actor = { role: currentUser.role, id: currentUser.userId };
    const adder = submission.added_by ?? null;
    const creatorRecruiters = await recruiterProfileIds([adder, ...interviews.map((iv) => iv.created_by)]);
    const isRecruiterRole = (id: string | null) => !!id && creatorRecruiters.has(id);
    const candidateDecision = {
      actorId: actor.id || '',
      creatorId: adder,
      creatorIsRecruiter: isRecruiterRole(adder),
      currentRecruiterIds: demand.recruiterIds,
    };
    const candidateBlocked = actor.role === 'ta' && !canEditAsRecordCreator(candidateDecision)
      ? creatorEditBlockMessage(candidateDecision, 'candidate in this pipeline')
      : null;

    return NextResponse.json({
      submission: {
        ...submission,
        candidates: submission.candidates
          ? { ...submission.candidates, current_ctc: toNum(submission.candidates.current_ctc), expected_ctc: toNum(submission.candidates.expected_ctc) }
          : null,
        can_edit: candidateBlocked == null,
        edit_blocked_reason: candidateBlocked,
      },
      events,
      interviews: interviews.map((iv) => {
        const creator = iv.created_by ?? null;
        const decision = {
          actorId: actor.id || '',
          creatorId: creator,
          creatorIsRecruiter: isRecruiterRole(creator),
          currentRecruiterIds: demand.recruiterIds,
        };
        const blocked = actor.role === 'ta' && !canEditAsRecordCreator(decision)
          ? creatorEditBlockMessage(decision, 'interview')
          : null;
        // serializeInterview aliases level -> round_name (and normalizes the date/time
        // columns), so the panel can name the round each status/result belongs to.
        return { ...serializeInterview(iv), can_manage: blocked == null, manage_blocked_reason: blocked };
      }),
      otherDemands,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/candidates/[dcId]:', error);
    return NextResponse.json({ error: 'Failed to load candidate detail' }, { status: 500 });
  }
}

/** PATCH sourcing type (Active / Backup). The cap still auto-assigns it; this is the manual override. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string; dcId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { requestId, dcId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to update this profile' }, { status: 403 });
    }
    const body = await request.json();
    const sourcingType = body?.sourcing_type;
    if (sourcingType !== 'active' && sourcingType !== 'backup') {
      return NextResponse.json({ error: 'sourcing_type must be active or backup' }, { status: 400 });
    }
    const existing = await prisma.submissions.findFirst({ where: { id: dcId, demand_id: demand.id } });
    if (!existing) return NextResponse.json({ error: 'Candidate not found in this demand' }, { status: 404 });
    const updated = await prisma.submissions.update({ where: { id: dcId }, data: { sourcing_type: sourcingType } });
    return NextResponse.json({ submission: updated, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/demands/[requestId]/candidates/[dcId]:', error);
    return NextResponse.json({ error: 'Failed to update sourcing type' }, { status: 500 });
  }
}
