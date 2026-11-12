'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2, Search, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { canViewNotifications } from '@/lib/notifications/permissions';
import { useDebounce } from '@/hooks/useDebounce';
import { NOTIFICATIONS_SEARCH_DEBOUNCE_MS } from '@/lib/notifications/constants';
import {
  useNotificationItems,
  useUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/queries/notifications/useNotificationsQuery';
import type { NotificationFilter } from '@/services/notification.service';
import type { Profile } from '@/components/types';

/** "5 min ago" style relative timestamps (spec §23). Compact, no dependency. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

const TABS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

/**
 * Busy indicator for the feed: a bare circular spinner, no text.
 *
 * Deliberately shown ONLY while a fetch is actually blocking the user — the first load of a tab,
 * a search, or pulling the next page. Background refetches (the open-dropdown refresh, window
 * focus, mark-read invalidation) deliberately do NOT trigger it: replacing an already-rendered
 * list with a spinner every 45s would make the feed flicker and hide notifications the user is
 * reading. `isFetching` alone can't express that, so the call sites pass the specific flag.
 */
function FeedLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={`flex items-center justify-center ${className ?? 'p-6'}`}>
      <Loader2 className="h-4 w-4 animate-spin text-[#94a3b8]" />
    </div>
  );
}

/**
 * Header notification bell (spec §9/§10).
 *
 * Renders ONLY for the roles that can receive Demand-assignment notifications — SPOC and
 * Recruiter — via the centralised `canViewNotifications` predicate, so the role rule lives in one
 * place and is not duplicated in the header or anywhere else (spec §8).
 *
 * Delivery is polling-only (no WebSocket/SSE): the badge polls on a 45s interval and on window
 * focus, and the feed refetches each time the dropdown is opened (spec §18).
 */
export function NotificationBell({ currentUser }: { currentUser?: Profile | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationFilter>('all');

  const canView = canViewNotifications({ role: currentUser?.role, id: currentUser?.id });
  const unreadCountQuery = useUnreadNotificationCountQuery(canView);
  const unreadCount = unreadCountQuery.data ?? 0;

  // Search box (All tab only — Unread is already a narrow, short list, so a search box there
  // would be noise). The term is debounced so typing doesn't fire a query per keystroke, and it
  // is applied ONLY on the All tab so switching to Unread always shows the real unread set.
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, NOTIFICATIONS_SEARCH_DEBOUNCE_MS);
  const activeSearch = tab === 'all' ? debouncedSearch.trim() : '';

  // The feed is only fetched while the dropdown is open, so merely visiting a page does not
  // pull notification rows the user never asked to see (spec §20).
  const feed = useNotificationItems(tab, canView && open, activeSearch);
  const markRead = useMarkNotificationReadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Infinite scroll (spec §11): fetch the next cursor page when the user nears the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [open, feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  // Infinite-scroll dead-end guard: the handler above only runs on a real scroll event, so if a
  // page is short enough not to overflow the panel there is no scrollbar, no event, and the user
  // would be stuck on page 1 forever. Top up while the loaded pages still don't fill the panel.
  // Guarded on !isFetching so a request is never issued while one is in flight; it terminates
  // as soon as the panel overflows or the history runs out.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    if (el.scrollHeight <= el.clientHeight && feed.hasNextPage && !feed.isFetching && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  }, [open, feed.items.length, feed.hasNextPage, feed.isFetching, feed.isFetchingNextPage, feed.fetchNextPage]);

  if (!canView) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Refetch on open so anything that arrived while the dropdown was closed shows up
    // immediately (spec §18).
    if (next) {
      feed.refetch();
      unreadCountQuery.refetch();
    }
  };

  const handleClick = async (id: string, href: string | null) => {
    // Optimistic in the mutation; navigate straight away so the click feels instant.
    if (!markRead.variables) markRead.mutate(id);
    setOpen(false);
    if (href) router.push(href);
  };

  const isEmpty = feed.items.length === 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="relative flex cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-2 text-[#475569] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
        >
          <Bell className="h-[18px] w-[18px]" />
          {/* No "0" badge — only rendered when there is something unread (spec §9). */}
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#dc2626] px-1 text-[0.62rem] font-bold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[380px] max-w-[92vw] p-0">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <span className="text-[0.9rem] font-bold text-[#0f172a]">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[0.75rem] font-semibold text-[#2563eb] transition-colors hover:bg-[#eff6ff] disabled:opacity-60"
            >
              {markAllRead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all as read
            </button>
          )}
        </div>

        {/* All / Unread tabs (spec §10) */}
        <div className="flex items-center gap-1 border-b border-[#e2e8f0] px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-[0.8rem] font-semibold transition-colors ${
                tab === t.id ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#64748b] hover:bg-[#f8fafc]'
              }`}
            >
              {t.label}
              {t.id === 'unread' && unreadCount > 0 && <span className="ml-1.5">({unreadCount})</span>}
            </button>
          ))}
        </div>

        {/* Search — All tab only, and resolved server-side so it reaches the whole history,
            not just the pages already loaded into the dropdown. */}
        {tab === 'all' && (
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by requirement, role or text…"
              className="w-full border-none bg-transparent p-0 text-[0.8rem] outline-none placeholder:text-[#94a3b8]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="shrink-0 cursor-pointer rounded-full p-0.5 text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#475569]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div ref={scrollRef} className="max-h-[380px] overflow-y-auto overscroll-contain">
          {/* First load of this tab / this search term: nothing to show yet, so just a spinner.
              Deliberately `isLoading`, not `isFetching` — a background refetch must not blank a
              list the user is already reading. */}
          {feed.isLoading ? (
            <FeedLoader label="Loading notifications" />
          ) : feed.isError ? (
            <div className="p-6 text-center text-[0.8rem] text-[#dc2626]">Unable to load notifications. Try again.</div>
          ) : isEmpty ? (
            <div className="p-6 text-center text-[0.8rem] text-[#94a3b8]">
              {activeSearch
                ? 'No notifications match your search.'
                : tab === 'unread'
                  ? 'No unread notifications.'
                  : 'No notifications yet.'}
            </div>
          ) : (
            <ul>
              {feed.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n.id, n.href ?? null)}
                    className={`flex w-full cursor-pointer flex-col items-start gap-0.5 border-b border-[#f1f5f9] px-4 py-3 text-left transition-colors last:border-none hover:bg-[#f8fafc] ${
                      n.is_read ? 'opacity-60' : 'bg-[#f8fbff]'
                    }`}
                  >
                    <span className="flex w-full items-start gap-2">
                      {/* Unread marker: a dot, so unread is distinguishable without relying on
                          colour alone (spec §23). */}
                      <span
                        aria-hidden
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-[#2563eb]'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.83rem] font-semibold text-[#0f172a]">{n.title}</span>
                        <span className="block truncate text-[0.78rem] text-[#64748b]">{n.message}</span>
                        <span className="mt-0.5 block text-[0.72rem] text-[#94a3b8]">{timeAgo(n.created_at)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Bottom loader while the next page is fetched (spec §11). Appended BELOW the existing
              rows rather than replacing them, so the history already loaded stays readable while
              older notifications are being pulled in. */}
          {feed.isFetchingNextPage && <FeedLoader label="Loading more notifications" className="p-3" />}
          {!feed.hasNextPage && feed.items.length > 0 && !feed.isFetchingNextPage && (
            <div className="p-3 text-center text-[0.72rem] text-[#cbd5e1]">
              {activeSearch ? 'No more matching notifications' : "You're all caught up"}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
