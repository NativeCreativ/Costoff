import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const isActive = Boolean(body?.is_active);
    const existing = await prisma.skill_categories.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    const category = await prisma.skill_categories.update({ where: { id }, data: { is_active: isActive } });
    return NextResponse.json({ category, success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PUT .../toggle:', error);
    return NextResponse.json({ error: 'Failed to toggle category' }, { status: 500 });
  }
}