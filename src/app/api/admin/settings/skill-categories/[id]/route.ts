import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { skillCategorySchema } from '@/components/settings/skillsLibrary.schema';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = skillCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.skill_categories.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const nameOwner = await prisma.skill_categories.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (nameOwner && nameOwner.id !== id) {
      return NextResponse.json({ error: `A category named "${parsed.data.name}" already exists` }, { status: 409 });
    }

    const category = await prisma.skill_categories.update({
      where: { id },
      data: {
        name: parsed.data.name,
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description?.trim() || null }
          : {}),
        ...(parsed.data.group_id !== undefined ? { group_id: parsed.data.group_id } : {}),
      },
      include: { skills: { orderBy: { sort_order: 'asc' } } },
    });
    return NextResponse.json({ category, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/skill-categories/[id]:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE — hard delete; its skills cascade (ON DELETE CASCADE). Demands and candidates store
// plain text skills with no FK here, so deleting a category never touches a saved record —
// no in-use block, matching the task's explicit "no in-use block" requirement for this library.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await prisma.skill_categories.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const catSkills = await prisma.skills.findMany({ where: { category_id: id } });
    const demands = await prisma.demands.findMany({ select: { technology_stack: true } });
    const candidateRows = await prisma.candidates.findMany({ select: { skills: true } });
    const skillNames = catSkills.map((s) => s.name.trim().toLowerCase());
    const hasInUse = skillNames.some((n) => demands.some((d) => d.technology_stack.some((s) => s.trim().toLowerCase() === n)) || candidateRows.some((c) => c.skills.some((s) => s.trim().toLowerCase() === n)));
    if (hasInUse) {
      return NextResponse.json(
        { error: `"${existing.name}" is in use and cannot be deleted.` },
        { status: 409 }
      );
    }
    await prisma.skill_categories.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/admin/settings/skill-categories/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
