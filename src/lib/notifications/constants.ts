/**
 * Notification types and their structured payloads.
 *
 * Content is generated from structured data (see buildNotificationContent below) rather than
 * stored as caller-supplied free text, so every producer of the same type produces identical
 * copy and the wording lives in exactly one place.
 */

/** profile_submitted: a TA submitted a Sourcing profile for review (to the demand's AM / SPOC).
 *  profile_reviewed: the AM / SPOC approved or rejected it (to whoever submitted it). */
export const NOTIFICATION_TYPES = ['demand_assigned', 'profile_submitted', 'profile_reviewed'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The entity kinds a notification can point at. Drives the UI's navigation target. */
export const NOTIFICATION_ENTITY_TYPES = ['demand'] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

/** Roles that get a notification bell in the header (spec §8): SPOC and Recruiter only.
 *  Deliberately excludes super_admin / account_manager / viewer — they perform the assignment,
 *  so they have nothing to be told about it. */
// Review batch 4 (Nov 2026): Account Managers get a bell too — profiles are submitted to them.
export const NOTIFICATION_BELL_ROLES = ['spoc', 'ta', 'account_manager'] as const;

/** Default page size for the dropdown feed. The spec asks for 5–6 initially. */
export const NOTIFICATIONS_PAGE_SIZE = 6;

/** Poll interval for the unread badge. 45s is near-real-time enough for an ATS without
 *  hammering the DB, per spec §18 (explicitly not 1–5s). */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 45_000;

/**
 * Columns the dropdown's search box matches against.
 *
 * Search is resolved in the DATABASE, not against the pages already loaded into the dropdown:
 * the feed is cursor-paginated, so the client only ever holds a slice of the history and would
 * otherwise report "no match" for a notification that is simply on page 7. Always ANDed with the
 * `user_id` session scope, so search can never widen the feed past the caller's own rows.
 *
 * `title` already embeds the Requirement ID ("Demand CSF-2026-0004 assigned to you"), so
 * searching by requirement ID is covered without matching a joined demand column.
 */
export const NOTIFICATION_SEARCH_FIELDS = ['title', 'message'] as const;

/** Debounce for the dropdown search box, so typing doesn't fire a query per keystroke. */
export const NOTIFICATIONS_SEARCH_DEBOUNCE_MS = 400;

export interface DemandAssignedPayload {
  requestId: string;
  jobTitle?: string | null;
  /** Which assignment slot the recipient now holds on this demand. */
  roleInDemand: 'spoc' | 'recruiter';
  /** The recipient. Part of the dedupe key so several recruiters on one demand each get their
   *  own notification instead of colliding on a shared key. */
  userId: string;
  /**
   * Fingerprint of the assignment state BEFORE the change. Part of the dedupe key so the key
   * identifies a specific *transition* rather than a (demand, user) pair forever:
   *   • a retried / double-submitted identical request shares the same "before" state, so it
   *     produces the same key and is de-duplicated (spec §5), and
   *   • a legitimate re-assignment after a removal has a DIFFERENT "before" state, so it is
   *     correctly allowed to notify again (spec §4/§7).
   */
  previousStateFingerprint: string;
  actorName?: string | null;
}

export interface NotificationContent {
  type: NotificationType;
  title: string;
  message: string;
  entity_type: NotificationEntityType;
  entity_id: string;
  dedupe_key: string;
}

const ROLE_LABEL: Record<DemandAssignedPayload['roleInDemand'], string> = {
  spoc: 'as SPOC',
  recruiter: 'as Recruiter',
};

/**
 * Builds the stored title/message for a Demand-assignment notification from structured data.
 *
 * The job title is included in the message when known (spec §2) and the Requirement ID is always
 * in the title, so the dropdown stays scannable and the message reads naturally:
 *   title:   "Demand CSF-2026-0004 assigned to you"
 *   message: "DevOps Engineer — you are now assigned as Recruiter."
 */
export function buildNotificationContent(payload: DemandAssignedPayload, demandId: string): NotificationContent {
  const job = payload.jobTitle?.trim();
  return {
    type: 'demand_assigned',
    title: `Demand ${payload.requestId} assigned to you`,
    message: job
      ? `${job} — you are now assigned ${ROLE_LABEL[payload.roleInDemand]}.`
      : `You are now assigned ${ROLE_LABEL[payload.roleInDemand]}.`,
    entity_type: 'demand',
    entity_id: demandId,
    // Idempotency key identifies a specific ASSIGNMENT TRANSITION:
    //   demand + recipient + slot + the "before" fingerprint.
    // The recipient must be in the key (otherwise two recruiters on one demand collide and
    // `skipDuplicates` silently drops one), and the "before" fingerprint must be in the key
    // (otherwise a recruiter removed and later re-assigned could never be notified again).
    dedupe_key: `demand_assigned:${demandId}:${payload.userId}:${payload.roleInDemand}:${payload.previousStateFingerprint}`,
  };
}
