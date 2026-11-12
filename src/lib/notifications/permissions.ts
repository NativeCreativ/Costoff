/**
 * Notification permissions.
 *
 * Centralised here so the bell's visibility is decided in ONE place and by ONE predicate, per
 * spec §8 ("do not hard-code role checks in multiple frontend components"). The backend uses the
 * same predicate to refuse the notification APIs to roles that should never poll them.
 *
 * Role scope: only SPOC (`spoc`) and Recruiter (`ta`) receive Demand-assignment notifications —
 * they are the people being assigned work. Super Admin / Account Manager perform the assignment,
 * and viewer/hr have no assignment relationship, so none of them need a bell.
 */

import { NOTIFICATION_BELL_ROLES } from './constants';

interface NotificationActor {
  role?: string | null;
  id?: string | null;
}

/** May this actor see a notification bell / poll the notification APIs? */
export function canViewNotifications(actor: NotificationActor): boolean {
  return !!actor.role && (NOTIFICATION_BELL_ROLES as readonly string[]).includes(actor.role);
}

/**
 * May this actor act on this notification?
 *
 * Ownership is mandatory and is always derived from the session, never a request parameter
 * (spec §21) — a user may only read/mark-read their OWN notifications, so this is always
 * equivalent to "is this my notification", enforced alongside a `user_id` scoped query.
 */
export function canAccessNotification(actor: NotificationActor, notification: { user_id: string }): boolean {
  return !!actor.id && notification.user_id === actor.id;
}
