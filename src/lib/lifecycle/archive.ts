/**
 * Hard-delete eligibility rules for Candidates and Interviews.
 *
 * Deletion is a real `prisma.candidates.delete()` / `prisma.interviews.delete()` —
 * permanent, and (for a candidate) cascading away its submissions, interviews, offers,
 * onboardings and submission_events via the schema's ON DELETE CASCADE. Because of that
 * blast radius, it is only ever allowed once the record is no longer part of a LIVE
 * workflow — a candidate with no active submission / scheduled interview / open offer /
 * open onboarding (i.e. everything on it is already closed, rejected, dropped or
 * completed), or an interview that has already reached a terminal status (Completed).
 * The point is to stop someone deleting a candidate or interview out from under an
 * active requisition — not to retain history once that requisition has closed.
 */

import { prisma } from '@/lib/db/prisma';
import { SUBMISSION_TERMINAL_EXIT_STATUSES } from '@/lib/demandFulfillment/constants';

/** Interviews.status value used as the "removed from active workflow" marker. */
export const INTERVIEW_CANCELLED_STATUS = 'Cancelled';

/**
 * An interview is "in use" while it is Scheduled. Completed / No-Show / Rescheduled /
 * Cancelled are all settled states and may be archived.
 */
export function isInterviewActive(status?: string | null): boolean {
  return (status ?? 'Scheduled') === 'Scheduled';
}

export interface ArchiveBlocker {
  /** Human-readable reason, returned to the client as the validation message. */
  message: string;
}

/**
 * Blocks archiving a Candidate while it is still part of a live workflow.
 *
 * Uses the existing model fields rather than inventing new ones:
 *   - submissions.is_active / current_status (terminal exits: rejected/dropped/backed_out)
 *   - interviews.status (Scheduled is live)
 *   - offers.status   (Pending / Accepted are live)
 *   - onboardings     (closed_at IS NULL is live)
 */
export async function findCandidateArchiveBlocker(candidateId: string): Promise<ArchiveBlocker | null> {
  const reasons: string[] = [];

  const liveSubmissions = await prisma.submissions.findMany({
    where: {
      candidate_id: candidateId,
      is_active: true,
      current_status: { notIn: SUBMISSION_TERMINAL_EXIT_STATUSES as unknown as string[] },
    },
    select: { current_status: true, demands: { select: { request_id: true } } },
  });
  if (liveSubmissions.length > 0) {
    const where = liveSubmissions
      .map((s) => `${s.demands?.request_id ?? 'a demand'} (${s.current_status})`)
      .join(', ');
    reasons.push(`an active pipeline submission in ${where}`);
  }

  const liveInterviews = await prisma.interviews.findMany({
    where: { candidate_id: candidateId, status: { not: INTERVIEW_CANCELLED_STATUS } },
    select: { id: true, status: true },
  });
  const scheduled = liveInterviews.filter((i) => isInterviewActive(i.status));
  if (scheduled.length > 0) {
    reasons.push(`${scheduled.length} scheduled interview${scheduled.length > 1 ? 's' : ''}`);
  }

  const liveOffers = await prisma.offers.findMany({
    where: { candidate_id: candidateId, status: { in: ['Pending', 'Accepted'] } },
    select: { id: true },
  });
  if (liveOffers.length > 0) {
    reasons.push(`${liveOffers.length} open offer${liveOffers.length > 1 ? 's' : ''}`);
  }

  const openOnboardings = await prisma.onboardings.findMany({
    where: { candidate_id: candidateId, closed_at: null },
    select: { id: true },
  });
  if (openOnboardings.length > 0) {
    reasons.push(`${openOnboardings.length} open onboarding${openOnboardings.length > 1 ? 's' : ''}`);
  }

  if (reasons.length === 0) return null;

  return {
    message:
      `This candidate is still part of an active workflow (${reasons.join('; ')}). ` +
      `Close or cancel it first, then archive. Archiving never destroys history.`,
  };
}
