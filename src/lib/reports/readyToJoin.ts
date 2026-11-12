/**
 * "Ready to join" (Advanced Report 1), in one place so the definition is easy to change:
 *
 *   a non-archived candidate whose notice period is Immediate, OR whose Available From date is
 *   today or earlier — AND who is not already placed (offer accepted, onboarding, BGV or joined)
 *   on any demand.
 */
export const READY_TO_JOIN_NOTICE_PERIODS = ['Immediate'];

export const PLACED_SUBMISSION_STATUSES = ['offer_accepted', 'onboarding', 'bgv_pending', 'bgv_verified', 'joined'];
