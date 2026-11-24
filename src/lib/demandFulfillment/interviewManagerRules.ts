/**
 * interviewManagerRules.ts
 *
 * Pure validation and sequencing rules for multi-round interview management (Review Comments 13 & 14).
 * Enforces:
 * 1. Top-down sequencing: Round N can only be active/scheduled if Round N-1 is Completed with Result "Selected".
 * 2. Mandatory reason on Rescheduled / Cancelled.
 * 3. Mandatory custom reason when reason is "Others".
 * 4. Mandatory reject reason when result is "Rejected".
 * 5. Rejection cascade condition.
 */

export interface RoundStatusCheck {
  status: string | null;
  result?: string | null;
}

/**
 * Checks whether round with `roundOrder` is unlocked.
 * Round 1 is always unlocked. Round N requires Round N-1 to be Completed + Selected.
 */
export function canUnlockRound(roundOrder: number, previousRound?: RoundStatusCheck | null): boolean {
  if (roundOrder <= 1) return true;
  if (!previousRound) return false;
  return previousRound.status === 'Completed' && previousRound.result === 'Selected';
}

export interface InterviewRecordInput {
  status: string;
  result?: string | null;
  reason?: string | null;
  custom_reason?: string | null;
  reject_reason?: string | null;
}

/**
 * Validates mandatory fields based on lifecycle status and result.
 */
export function validateInterviewRecord(data: InterviewRecordInput): { valid: boolean; error?: string } {
  // If Rescheduled or Cancelled, reason is mandatory
  if (data.status === 'Rescheduled' || data.status === 'Cancelled') {
    if (!data.reason || !data.reason.trim()) {
      return { valid: false, error: `Reason is required when interview status is ${data.status}` };
    }
    if (data.reason === 'Others' && (!data.custom_reason || !data.custom_reason.trim())) {
      return { valid: false, error: 'Please enter a custom reason when "Others" is selected' };
    }
  }

  // If Completed and Rejected, reject_reason is mandatory
  if (data.status === 'Completed' && data.result === 'Rejected') {
    if (!data.reject_reason || !data.reject_reason.trim()) {
      return { valid: false, error: 'Reject reason is mandatory when candidate is Rejected' };
    }
  }

  return { valid: true };
}

/**
 * Checks if a round result triggers a rejection cascade (cancelling/deleting subsequent rounds).
 */
export function shouldCascadeRejection(result?: string | null): boolean {
  return result === 'Rejected';
}
