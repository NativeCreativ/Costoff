import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { reorderSchema } from '@/components/settings/skillsLibrary.schema';

// PUT /api/admin/settings/skill-categories/reorder — Body: { orderedIds: string[] }, the full
// list of category ids in their new display order.
export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { orderedIds } = parsed.data;
    const existing = await prisma.skill_categories.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((c) => c.id));
    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      return NextResponse.json({ error: 'orderedIds must include every category exactly once' }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.skill_categories.update({ where: { id }, data: { sort_order: index + 1 } }))
    );

    const categories = await prisma.skill_categories.findMany({
      orderBy: { sort_order: 'asc' },
      include: { skills: { orderBy: { sort_order: 'asc' } } },
    });
    return NextResponse.json({ categories, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/skill-categories/reorder:', error);
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
  }
}
