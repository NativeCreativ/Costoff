import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { changePasswordSchema, selfChangePasswordSchema } from '@/components/users/user.schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    const isSelf = id === currentUser.userId;

    // Admin resetting someone else's password: super_admin only, no old password needed.
    // Changing your own password: any authenticated user, current password must verify.
    if (!isSelf && currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (isSelf) {
      const parsed = selfChangePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const profile = await prisma.profiles.findUnique({ where: { id }, select: { password_hash: true } });
      if (!profile?.password_hash || !(await verifyPassword(parsed.data.oldPassword, profile.password_hash))) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      const password_hash = await hashPassword(parsed.data.newPassword);
      await prisma.profiles.update({ where: { id }, data: { password_hash } });
      return NextResponse.json({ success: true });
    }

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const password_hash = await hashPassword(parsed.data.newPassword);

    try {
      await prisma.profiles.update({ where: { id }, data: { password_hash } });
    } catch (dbError) {
      console.error('Error changing password:', dbError);
      return NextResponse.json({ error: 'Failed to change password' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/users/[id]/password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
