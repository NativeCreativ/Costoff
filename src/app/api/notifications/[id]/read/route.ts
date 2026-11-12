import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewNotifications, canAccessNotification } from '@/lib/notifications/permissions';

/**
 * PATCH /api/notifications/[id]/read — mark one notification as read.
 *
 * Ownership is enforced server-side (spec §15/§21): the lookup is scoped to the session user, so
 * a notification belonging to somebody else is reported as 404 (not 403) — a 403 would confirm
 * that the id exists, which is itself a small information leak.
 *
 * Idempotent (spec §24 edge case 13): marking an already-read notification succeeds and simply
 * leaves read_at as it was, rather than erroring.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    if (!canViewNotifications({ role: currentUser.role, id: currentUser.userId })) {
      return NextResponse.json({ error: 'You do not have permission to update notifications' }, { status: 403 });
    }
    const { id } = await params;

    // Scoped lookup: only ever finds the caller's own notification.
    const notification = await prisma.notifications.findFirst({
      where: { id, user_id: currentUser.userId },
      select: { id: true, user_id: true, is_read: true, read_at: true, entity_type: true, entity_id: true },
    });
    if (!notification || !canAccessNotification({ role: currentUser.role, id: currentUser.userId }, notification)) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    if (notification.is_read) {
      return NextResponse.json({ notification, success: true });
    }

    const updated = await prisma.notifications.update({
      where: { id: notification.id },
      data: { is_read: true, read_at: new Date() },
    });

    return NextResponse.json({ notification: updated, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/notifications/[id]/read:', error);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}
