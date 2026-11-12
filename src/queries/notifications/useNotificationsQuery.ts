'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationFilter,
} from '@/services/notification.service';
import { queryKeys } from '@/lib/queryKeys';
import { NOTIFICATIONS_PAGE_SIZE, NOTIFICATIONS_POLL_INTERVAL_MS } from '@/lib/notifications/constants';

/**
 * The notification feed, cursor-paginated with useInfiniteQuery (spec §11).
 *
 * Pages APPEND rather than replace — TanStack flattens them, and getNextPageParam returns the
 * server's opaque `nextCursor`. `hasMore: false` ends the feed.
 *
 * The same hook backs both the All and Unread tabs (spec §13/§14); `filter` is part of the query
 * key so switching tabs is a separate cache entry rather than a refetch of the other's pages.
 *
 * `search` narrows the feed in the DATABASE. It must not be applied to the already-loaded pages:
 * the dropdown only ever holds a slice of the history, so a client-side filter would report "no
 * match" for a notification sitting on page 7. Each term is its own cache entry, so a term
 * searched before is instant, and pagination stays correct because the cursor walks the MATCHED
 * set server-side.
 *
 * `limit` is NOT taken from the caller — it is always NOTIFICATIONS_PAGE_SIZE (5–6 per page), so
 * the feed can never be pulled into the dropdown in a single request by a stale prop or a
 * refetch. The server clamps it again independently.
 */
export function useNotificationsInfiniteQuery(filter: NotificationFilter, enabled: boolean, search = '') {
  const term = search.trim();
  return useInfiniteQuery({
    queryKey: queryKeys.notifications(filter, term),
    queryFn: ({ pageParam }) => getNotifications({ filter, limit: NOTIFICATIONS_PAGE_SIZE, cursor: pageParam ?? null, search: term }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled,
    staleTime: 15 * 1000,
  });
}

/** Flattened items across all loaded pages — what the dropdown renders. */
export function useNotificationItems(filter: NotificationFilter, enabled: boolean, search = '') {
  const query = useNotificationsInfiniteQuery(filter, enabled, search);
  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}

/**
 * Unread badge count (spec §19).
 *
 * A dedicated lightweight endpoint — the list is never fetched just to count. Polls every 45s
 * (spec §18: reasonable interval, explicitly not 1–5s) and refetches on window focus so the
 * badge catches up when the user comes back to the tab.
 */
export function useUnreadNotificationCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notificationsUnreadCount,
    queryFn: getUnreadNotificationCount,
    enabled,
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
  });
}

/**
 * Mark one notification read.
 *
 * Optimistically flips the item in every cached feed page so the UI responds instantly
 * (spec §15), then invalidates the feed and the badge count. On failure the optimistic update
 * is rolled back by the refetch.
 */
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshots = queryClient.getQueriesData<any>({ queryKey: ['notifications'] });

      queryClient.setQueriesData<any>({ queryKey: ['notifications'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) =>
              item.id === id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
            ),
          })),
        };
      });

      return { snapshots };
    },
    onError: (_err, _id, context) => {
      context?.snapshots?.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Mark every unread notification read (spec §16) — refreshes both tabs and the badge. */
export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}