import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildSearchWhere } from '@/lib/search';
import { canViewNotifications } from '@/lib/notifications/permissions';
import { NOTIFICATIONS_PAGE_SIZE, NOTIFICATION_SEARCH_FIELDS } from '@/lib/notifications/constants';
import { decodeCursor, encodeCursor } from '@/lib/notifications/cursor';
import { attachNavigationForUser } from '@/lib/notifications/navigation';

/**
 * GET /api/notifications — the authenticated user's notification feed, newest first.
 *
 *   GET /api/notifications?limit=6
 *   GET /api/notifications?limit=6&cursor=...&filter=unread
 *   GET /api/notifications?limit=6&search=CSF-2026
 *
 * Cursor-paginated (keyset) per spec §12. Responds with:
 *   { items, nextCursor, hasMore }
 *
 * `search` narrows the same cursor-paginated feed by text. It is filtered in the DATABASE rather
 * than in the client because the dropdown only ever holds a slice of the history — a client-side
 * filter could only ever search the loaded pages. It is ANDed with the `user_id` scope, so it
 * narrows the caller's own notifications and can never reach anybody else's.
 *
 * Security: the recipient is ALWAYS the session user (spec §21). There is no `user_id` query
 * parameter — one cannot ask for someone else's notifications.
 *
 * Roles: restricted to the roles that hold a notification bell (SPOC / Recruiter) so no other
 * role can poll or enumerate this data at all.
 */
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canViewNotifications({ role: currentUser.role, id: currentUser.userId })) {
      return NextResponse.json({ error: 'You do not have permission to view notifications' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
    // Bounded so a caller cannot ask for the whole history in one request (spec §20).
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : NOTIFICATIONS_PAGE_SIZE, 1), 50);
    const unreadOnly = searchParams.get('filter') === 'unread';
    const search = searchParams.get('search') || '';
    const cursor = decodeCursor(searchParams.get('cursor'));

    // Keyset predicate over the exact sort tuple. created_at has second-level precision in
    // practice, so `id` is the deterministic tie-break that makes the ordering total.
    const cursorWhere: Prisma.notificationsWhereInput = cursor
      ? {
          OR: [
            { created_at: { lt: new Date(cursor.createdAt) } },
            { created_at: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        }
      : {};

    const searchOr = buildSearchWhere<Prisma.notificationsWhereInput>(search, NOTIFICATION_SEARCH_FIELDS);

    const where: Prisma.notificationsWhereInput = {
      user_id: currentUser.userId,
      ...(unreadOnly ? { is_read: false } : {}),
      // Composes with the cursor's own OR below as a top-level AND, so "search + next page"
      // stays correct: each page is the next slice of the MATCHED set, not of the whole feed.
      ...(searchOr ? { OR: searchOr } : {}),
      AND: [cursorWhere],
    };

    // Fetch one extra row to detect hasMore without a second COUNT query.
    const rows = await prisma.notifications.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    // Resolve navigation server-side so the client never has to know how a demand is routed
    // (and can never render a link the user isn't allowed to follow — spec §17/§24).
    const items = await attachNavigationForUser(page, { role: currentUser.role, id: currentUser.userId });

    return NextResponse.json({
      items,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id }) : null,
      hasMore,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/notifications:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
