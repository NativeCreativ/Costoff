import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { skillGroupSchema } from '@/components/settings/skillsLibrary.schema';

/** PUT — rename / describe / activate or deactivate a Skill Group. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const parsed = skillGroupSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });
    const existing = await prisma.skill_groups.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Skill group not found' }, { status: 404 });
    const clash = await prisma.skill_groups.findFirst({ where: { name: { equals: parsed.data.name, mode: 'insensitive' }, NOT: { id } } });
    if (clash) return NextResponse.json({ error: `A skill group named "${parsed.data.name}" already exists` }, { status: 409 });
    const group = await prisma.skill_groups.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        ...(parsed.data.is_active !== undefined ? { is_active: parsed.data.is_active } : {}),
      },
    });
    return NextResponse.json({ group, success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PUT /api/admin/settings/skill-groups/[id]:', error);
    return NextResponse.json({ error: 'Failed to update the skill group' }, { status: 500 });
  }
}

/** DELETE — removes the group only. Its Skill Categories (and their skills) stay, ungrouped. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await prisma.$transaction([
      prisma.skill_categories.updateMany({ where: { group_id: id }, data: { group_id: null } }),
      prisma.skill_groups.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/admin/settings/skill-groups/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete the skill group' }, { status: 500 });
  }
}
