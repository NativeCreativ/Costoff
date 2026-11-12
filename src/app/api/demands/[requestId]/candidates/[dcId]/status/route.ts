import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { submissionStatusChangeSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { checkSubmissionStatusTransition } from '@/lib/demandFulfillment/statusTransitions';
import { SUBMISSION_TERMINAL_EXIT_STATUSES, type SubmissionFinalResult } from '@/lib/demandFulfillment/constants';
import { canEditAsRecordCreator, creatorEditBlockMessage } from '@/lib/auth/creatorScope';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { promoteNextBackup } from '@/lib/demandFulfillment/sourcingSlots';

const FINAL_RESULT_BY_TERMINAL_STATUS: Record<string, SubmissionFinalResult> = {
  rejected: 'rejected',
  shortlist_reject: 'rejected',
  dropped: 'dropped',
  backed_out: 'backed_out',
};

// PATCH /api/demands/[requestId]/candidates/[dcId]/status — the single endpoint for every
// candidate-in-demand pipeline transition. Every change writes a submission_events row.
export async function PATCH(
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
    const demandId = demand.id;
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to manage this demand\'s pipeline' }, { status: 403 });
    }

    const submission = await prisma.submissions.findFirst({ where: { id: dcId, demand_id: demandId } });
    if (!submission) {
      return NextResponse.json({ error: 'Candidate not found in this demand' }, { status: 404 });
    }

    // A pipeline transition is an edit of the candidate's relationship with THIS demand,
    // so it goes through the same canEditAsRecordCreator decision as the candidate record
    // itself: demand assignment -> view + create, creator -> edit. Recruiters allocated to
    // the demand can move a candidate they added, but not one another recruiter added, and
    // not one an Account Manager / Super Admin added.
    if (currentUser.role === 'ta') {
      const adder = submission.added_by ?? null;
      const decision = {
        actorId: currentUser.userId,
        creatorId: adder,
        creatorIsRecruiter: (await recruiterProfileIds([adder])).has(adder ?? ''),
        currentRecruiterIds: demand.recruiterIds,
      };
      if (!canEditAsRecordCreator(decision)) {
        return NextResponse.json({ error: creatorEditBlockMessage(decision, 'candidate in this pipeline') }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = submissionStatusChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { to_status, remark } = parsed.data;

    const check = checkSubmissionStatusTransition(submission.current_status, to_status, remark);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason || 'Transition not allowed', requiresRemark: check.requiresRemark }, { status: 400 });
    }

    const isTerminal = SUBMISSION_TERMINAL_EXIT_STATUSES.includes(to_status as any);
    const isJoined = to_status === 'joined';

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.submissions.update({
        where: { id: dcId },
        data: {
          current_status: to_status,
          is_active: !isTerminal, // rejected/dropped/backed_out leave the active pipeline; 'joined' stays active (still filling a slot)
          final_result: isTerminal ? FINAL_RESULT_BY_TERMINAL_STATUS[to_status] : isJoined ? 'joined' : submission.final_result,
        },
      });

      await tx.submission_events.create({
        data: {
          submission_id: dcId,
          event_type: 'status_change',
          from_status: submission.current_status,
          to_status,
          content: remark || null,
          created_by: currentUser.userId,
        },
      });

      // Entering onboarding: ensure a demand_onboarding row exists for this candidate.
      if (isTerminal && (submission.sourcing_type ?? 'active') === 'active') {
        await promoteNextBackup(tx, demandId);
      }

      if (to_status === 'onboarding') {
        await tx.onboardings.upsert({
          where: { submission_id: dcId },
          update: {},
          create: {
            submission_id: dcId,
            demand_id: demandId,
            candidate_id: submission.candidate_id,
            bgv_status: 'pending',
          },
        });
      }

      // Reaching joined: stamp joined_at on the onboarding row (the DB trigger derives
      // closure_due_at = joined_at + 90 days).
      if (isJoined) {
        await tx.onboardings.upsert({
          where: { submission_id: dcId },
          update: { joined_at: new Date() },
          create: {
            submission_id: dcId,
            demand_id: demandId,
            candidate_id: submission.candidate_id,
            bgv_status: 'verified',
            joined_at: new Date(),
          },
        });
      }

      return result;
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/demands/[requestId]/candidates/[dcId]/status:', error);
    return NextResponse.json({ error: 'Failed to update candidate status' }, { status: 500 });
  }
}
