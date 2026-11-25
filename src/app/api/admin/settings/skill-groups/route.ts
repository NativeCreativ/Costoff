import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { skillGroupSchema } from '@/components/settings/skillsLibrary.schema';

/** GET — every Skill Group (inactive too, for the settings screen) with its category count. */
export async function GET(_request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const groups = await prisma.skill_groups.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { skill_categories: true } } },
    });
    return NextResponse.json({
      groups: groups.map(({ _count, ...g }) => ({ ...g, category_count: _count.skill_categories })),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/admin/settings/skill-groups:', error);
    return NextResponse.json({ groups: [] }, { status: 500 });
  }
}

/** POST — Super Admin only (same rule as the rest of the skills library). */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const parsed = skillGroupSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });
    const clash = await prisma.skill_groups.findFirst({ where: { name: { equals: parsed.data.name, mode: 'insensitive' } } });
    if (clash) return NextResponse.json({ error: `A skill group named "${parsed.data.name}" already exists` }, { status: 409 });
    const max = await prisma.skill_groups.aggregate({ _max: { sort_order: true } });
    const group = await prisma.skill_groups.create({
      data: { name: parsed.data.name, description: parsed.data.description?.trim() || null, sort_order: (max._max.sort_order ?? 0) + 1 },
    });
    return NextResponse.json({ group, success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/admin/settings/skill-groups:', error);
    return NextResponse.json({ error: 'Failed to create the skill group' }, { status: 500 });
  }
}
