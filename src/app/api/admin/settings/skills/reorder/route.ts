import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { reorderSchema } from '@/components/settings/skillsLibrary.schema';

// PUT /api/admin/settings/skills/reorder — Body: { orderedIds }, the full list of skill ids
// within ONE category, in their new display order (the admin UI only ever reorders within the
// currently-selected category's chip list).
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
    const existing = await prisma.skills.findMany({ where: { id: { in: orderedIds } } });
    if (existing.length !== orderedIds.length) {
      return NextResponse.json({ error: 'orderedIds must reference existing skills only' }, { status: 400 });
    }
    const categoryIds = new Set(existing.map((s) => s.category_id));
    if (categoryIds.size > 1) {
      return NextResponse.json({ error: 'orderedIds must all belong to the same category' }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.skills.update({ where: { id }, data: { sort_order: index + 1 } }))
    );

    const skills = await prisma.skills.findMany({
      where: { category_id: existing[0]?.category_id },
      orderBy: { sort_order: 'asc' },
    });
    return NextResponse.json({ skills, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/skills/reorder:', error);
    return NextResponse.json({ error: 'Failed to reorder skills' }, { status: 500 });
  }
}
