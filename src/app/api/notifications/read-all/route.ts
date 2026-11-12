import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewNotifications } from '@/lib/notifications/permissions';

/**
 * PATCH /api/notifications/read-all — mark every unread notification of the SESSION user as read.
 *
 * Scoped by `user_id` from the session (spec §16/§21), so it can never touch another user's
 * notifications. Idempotent: running it when nothing is unread is a no-op.
 */
export async function PATCH() {
  try {
    const currentUser = await requireAuth();
    if (!canViewNotifications({ role: currentUser.role, id: currentUser.userId })) {
      return NextResponse.json({ error: 'You do not have permission to update notifications' }, { status: 403 });
    }

    const result = await prisma.notifications.updateMany({
      where: { user_id: currentUser.userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/notifications/read-all:', error);
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
  }
}
