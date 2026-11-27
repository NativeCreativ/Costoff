import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { userAccessSchema } from '@/components/users/user.schema';
import { sanitizeBlockedModules } from '@/lib/auth/moduleAccess';

/**
 * PUT /api/users/[id]/access — super_admin only. Sets which screens are switched off for one
 * employee. A super_admin always keeps every screen, so their list can't be changed.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { id } = await params;

    const parsed = userAccessSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const target = await prisma.profiles.findUnique({ where: { id }, select: { role: true } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'A Delivery Head always has full access' }, { status: 400 });
    }

    const profile = await prisma.profiles.update({
      where: { id },
      data: { blocked_modules: sanitizeBlockedModules(parsed.data.blocked_modules), updated_at: new Date() },
    });

    const { password_hash: _omit, ...safeProfile } = profile;
    return NextResponse.json({ profile: safeProfile, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/users/[id]/access:', error);
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 });
  }
}
