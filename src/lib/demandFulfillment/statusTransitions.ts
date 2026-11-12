import {
  DEMAND_LIFECYCLE_STATUS_VALUES,
  DEMAND_STATUS_REQUIRES_REMARK,
  SUBMISSION_FORWARD_ORDER,
  SUBMISSION_TERMINAL_EXIT_STATUSES,
  type SubmissionStatus,
} from './constants';

/**
 * Demand (parent) status transition rules.
 *
 * The state machine is intentionally permissive on structure (AM can move to
 * almost any status, forward or backward) but strict on *evidence*: every
 * backward move, and every move into On Hold / Cancelled, must carry a remark.
 * This mirrors the spec's "AM retains manual override — always with remark."
 */
export interface DemandTransitionCheck {
  allowed: boolean;
  requiresRemark: boolean;
  isReversal: boolean;
  reason?: string;
}

export function checkDemandStatusTransition(
  fromStatus: string | null | undefined,
  toStatus: string,
  remark: string | undefined | null
): DemandTransitionCheck {
  const hasRemark = !!remark && remark.trim().length > 0;

  if (fromStatus === toStatus) {
    return { allowed: false, requiresRemark: false, isReversal: false, reason: 'Demand is already in this status' };
  }

  if (fromStatus === 'Cancelled' && toStatus !== 'Cancelled') {
    // Reopening a cancelled demand — always requires remark, regardless of target.
    if (!hasRemark) {
      return { allowed: false, requiresRemark: true, isReversal: true, reason: 'A remark is required to reopen a cancelled demand' };
    }
    return { allowed: true, requiresRemark: true, isReversal: true };
  }

  const requiresRemark = DEMAND_STATUS_REQUIRES_REMARK.has(toStatus) || isDemandReversal(fromStatus, toStatus);

  if (requiresRemark && !hasRemark) {
    return {
      allowed: false,
      requiresRemark: true,
      isReversal: isDemandReversal(fromStatus, toStatus),
      reason: 'A remark is required for this status change',
    };
  }

  return { allowed: true, requiresRemark, isReversal: isDemandReversal(fromStatus, toStatus) };
}

function isDemandReversal(fromStatus: string | null | undefined, toStatus: string): boolean {
  if (!fromStatus) return false;
  const lifecycleValues: readonly string[] = DEMAND_LIFECYCLE_STATUS_VALUES;
  const fromIdx = lifecycleValues.indexOf(fromStatus);
  const toIdx = lifecycleValues.indexOf(toStatus);
  if (fromIdx === -1 || toIdx === -1) return false; // On Hold/Cancelled transitions handled separately
  return toIdx < fromIdx;
}

/**
 * Candidate-in-demand (submission) pipeline transition rules.
 *
 * Any stage can move to a terminal exit status (rejected/dropped/backed_out) freely
 * (with remark, enforced by the route). A backward move within the forward-ordered
 * happy path requires a remark; a forward move does not.
 */
export interface SubmissionTransitionCheck {
  allowed: boolean;
  requiresRemark: boolean;
  isReversal: boolean;
  isTerminalExit: boolean;
  reason?: string;
}

export function checkSubmissionStatusTransition(
  fromStatus: string,
  toStatus: string,
  remark: string | undefined | null
): SubmissionTransitionCheck {
  const hasRemark = !!remark && remark.trim().length > 0;

  if (fromStatus === toStatus) {
    return { allowed: false, requiresRemark: false, isReversal: false, isTerminalExit: false, reason: 'Candidate is already in this status' };
  }

  const isTerminalExit = SUBMISSION_TERMINAL_EXIT_STATUSES.includes(toStatus as SubmissionStatus);
  if (isTerminalExit) {
    if (!hasRemark) {
      return { allowed: false, requiresRemark: true, isReversal: false, isTerminalExit, reason: 'A remark is required to reject/drop a candidate' };
    }
    return { allowed: true, requiresRemark: true, isReversal: false, isTerminalExit };
  }

  if (SUBMISSION_TERMINAL_EXIT_STATUSES.includes(fromStatus as SubmissionStatus)) {
    return { allowed: false, requiresRemark: false, isReversal: false, isTerminalExit: false, reason: 'Candidate is already in a terminal state for this demand' };
  }

  const isReversal = isSubmissionReversal(fromStatus, toStatus);
  if (isReversal && !hasRemark) {
    return { allowed: false, requiresRemark: true, isReversal, isTerminalExit: false, reason: 'A remark is required to move a candidate backward' };
  }

  return { allowed: true, requiresRemark: isReversal, isReversal, isTerminalExit: false };
}

function isSubmissionReversal(fromStatus: string, toStatus: string): boolean {
  const fromIdx = SUBMISSION_FORWARD_ORDER.indexOf(fromStatus as SubmissionStatus);
  const toIdx = SUBMISSION_FORWARD_ORDER.indexOf(toStatus as SubmissionStatus);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx < fromIdx;
}
