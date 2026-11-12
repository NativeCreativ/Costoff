import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewNotifications } from '@/lib/notifications/permissions';

/**
 * GET /api/notifications/unread-count — lightweight badge count (spec §19).
 *
 * Deliberately a bare COUNT with no row fetch, so the header can poll it cheaply without
 * touching the notification list. Scoped to the session user only.
 */
export async function GET() {
  try {
    const currentUser = await requireAuth();
    if (!canViewNotifications({ role: currentUser.role, id: currentUser.userId })) {
      return NextResponse.json({ error: 'You do not have permission to view notifications' }, { status: 403 });
    }

    const count = await prisma.notifications.count({
      where: { user_id: currentUser.userId, is_read: false },
    });

    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/notifications/unread-count:', error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
