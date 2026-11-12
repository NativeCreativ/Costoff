import type { Prisma } from '@/generated/prisma/client';
import { nextSourcingType } from './sourcingSlots';

/** Thrown inside the add/reactivate transaction when the candidate is already active on the demand. */
export class CandidateAlreadyInPipelineError extends Error {
  constructor(public readonly stage: string) {
    super('CANDIDATE_ALREADY_IN_PIPELINE');
  }
}

/**
 * Puts a candidate into a demand's pipeline as Sourced, inside the caller's transaction. The one
 * implementation behind "Add Candidate" (POST /api/demands/[requestId]/candidates) and a "Fit"
 * call on the Call Log, so both follow the same rules:
 *
 *  - already ACTIVE on this demand → CandidateAlreadyInPipelineError (caller answers 409);
 *  - previously rejected/dropped on this demand → the SAME row is reactivated, history kept;
 *  - otherwise a new submission row.
 * Active vs Backup comes from the resume cap (nextSourcingType). Every path writes the
 * submission_events row the pipeline rules require.
 *
 * Checked inside the transaction so a concurrent add cannot slip past; the partial unique index
 * (submissions_active_demand_candidate_key) is the backstop — callers catch the P2002.
 */
export async function attachCandidateToDemand(
  tx: Prisma.TransactionClient,
  input: {
    demandId: string;
    numPositions: number | null | undefined;
    candidateId: string;
    source: string | undefined;
    positionSlot?: number | null;
    remark?: string | null;
    actorId: string;
  }
) {
  const existingOnDemand = await tx.submissions.findFirst({
    where: { demand_id: input.demandId, candidate_id: input.candidateId },
  });
  if (existingOnDemand?.is_active) {
    throw new CandidateAlreadyInPipelineError(existingOnDemand.current_status);
  }

  const sourcingType = await nextSourcingType(tx, input.demandId, input.numPositions);

  if (existingOnDemand) {
    const reactivated = await tx.submissions.update({
      where: { id: existingOnDemand.id },
      data: {
        is_active: true,
        current_status: 'sourced',
        final_result: null,
        source: input.source,
        sourcing_type: sourcingType,
        position_slot: input.positionSlot ?? existingOnDemand.position_slot,
        added_by: input.actorId,
      },
    });
    await tx.submission_events.create({
      data: {
        submission_id: reactivated.id,
        event_type: 'status_change',
        from_status: existingOnDemand.current_status,
        to_status: 'sourced',
        content: input.remark || 'Re-added to pipeline',
        created_by: input.actorId,
      },
    });
    return reactivated;
  }

  const created = await tx.submissions.create({
    data: {
      demand_id: input.demandId,
      candidate_id: input.candidateId,
      added_by: input.actorId,
      source: input.source,
      sourcing_type: sourcingType,
      position_slot: input.positionSlot ?? null,
      current_status: 'sourced',
      stage: 'phone_call_done', // keep legacy column populated for any code still reading it
    },
  });
  await tx.submission_events.create({
    data: {
      submission_id: created.id,
      event_type: 'status_change',
      from_status: null,
      to_status: 'sourced',
      content: input.remark || 'Added to demand pipeline',
      created_by: input.actorId,
    },
  });
  return created;
}
