import { api } from '@/lib/axios';
import type { NotificationFeedPage } from '@/components/types';

export type NotificationFilter = 'all' | 'unread';

export interface NotificationFeedParams {
  filter?: NotificationFilter;
  limit?: number;
  cursor?: string | null;
  /** Free-text term matched against the notification title/message, server-side. */
  search?: string;
}

/**
 * GET /api/notifications — one cursor-paginated page of the user's notifications.
 *
 * `cursor` is the opaque `nextCursor` from the previous page; omit it for the first page.
 */
export async function getNotifications({
  filter = 'all',
  limit,
  cursor,
  search,
}: NotificationFeedParams = {}): Promise<NotificationFeedPage> {
  const params: Record<string, string | number> = {};
  if (filter === 'unread') params.filter = 'unread';
  if (limit !== undefined) params.limit = limit;
  if (cursor) params.cursor = cursor;
  // Sent as a trimmed term only; omitted entirely when empty so the common case is unfiltered.
  const term = search?.trim();
  if (term) params.search = term;

  const { data } = await api.get('/notifications', { params });
  return {
    items: data.items || [],
    nextCursor: data.nextCursor ?? null,
    hasMore: !!data.hasMore,
  };
}

/** GET /api/notifications/unread-count — lightweight badge count (no rows fetched). */
export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count ?? 0;
}

/** PATCH /api/notifications/[id]/read — idempotent mark-as-read (own notifications only). */
export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${encodeURIComponent(id)}/read`);
}

/** PATCH /api/notifications/read-all — mark every unread notification of the current user read. */
export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}