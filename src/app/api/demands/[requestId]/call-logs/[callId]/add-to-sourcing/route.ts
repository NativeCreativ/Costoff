import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canLogDemandCall } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { attachCandidateToDemand, CandidateAlreadyInPipelineError } from '@/lib/demandFulfillment/attachCandidateToDemand';
import { isUniqueViolation } from '@/lib/masters/masterName';

/**
 * POST /api/demands/[requestId]/call-logs/[callId]/add-to-sourcing — the Demand Match follow-up:
 * after the candidate form is saved, the call's candidate goes into this demand's Sourcing as a
 * saved (not yet submitted) profile. Same rules as Add Candidate (attachCandidateToDemand).
 * Already active in the pipeline → nothing changes and `already_in_pipeline` is true.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ requestId: string; callId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId, callId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    if (!canLogDemandCall({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to add profiles to this demand' }, { status: 403 });
    }
    const call = await prisma.demand_call_logs.findFirst({
      where: { id: callId, demand_id: demand.id },
      select: { id: true, outcome: true, candidate_id: true, submission_id: true, candidates: { select: { source: true } } },
    });
    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    if (call.outcome !== 'demand_match') {
      return NextResponse.json({ error: 'Only a Demand Match call can add the candidate to Sourcing' }, { status: 400 });
    }

    let alreadyInPipeline = false;
    await prisma.$transaction(async (tx) => {
      try {
        const submission = await attachCandidateToDemand(tx, {
          demandId: demand.id,
          numPositions: demand.num_positions,
          candidateId: call.candidate_id,
          source: call.candidates?.source ?? undefined,
          remark: 'Added from a call (Demand Match)',
          actorId: currentUser.userId,
        });
        await tx.demand_call_logs.update({ where: { id: call.id }, data: { submission_id: submission.id } });
      } catch (error) {
        if (!(error instanceof CandidateAlreadyInPipelineError)) throw error;
        alreadyInPipeline = true;
      }
    });
    return NextResponse.json({ success: true, moved_to_sourcing: !alreadyInPipeline, already_in_pipeline: alreadyInPipeline });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'Someone else just added this candidate. Refresh to see it.' }, { status: 409 });
    }
    console.error('Error in POST /api/demands/[requestId]/call-logs/[callId]/add-to-sourcing:', error);
    return NextResponse.json({ error: 'Failed to add the candidate to Sourcing' }, { status: 500 });
  }
}
