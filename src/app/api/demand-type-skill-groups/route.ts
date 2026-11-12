import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { demandTypeSkillGroupsSchema } from '@/components/masterData/namedMaster.schema';

/**
 * GET /api/demand-type-skill-groups — every Demand Type's linked Skill Group ids, keyed by type
 * NAME as well as id because demands store the type as text. Open to any signed-in user, like
 * the other demand-form pickers (GET /api/skills-library).
 */
export async function GET() {
  try {
    await requireAuth();
    const rows = await prisma.demand_type_skill_categories.findMany({
      select: { demand_type_id: true, skill_category_id: true, demand_types: { select: { name: true } } },
    });
    const byType = new Map<string, { demand_type_id: string; demand_type_name: string; skill_category_ids: string[] }>();
    for (const row of rows) {
      const entry = byType.get(row.demand_type_id) ?? {
        demand_type_id: row.demand_type_id,
        demand_type_name: row.demand_types.name,
        skill_category_ids: [],
      };
      entry.skill_category_ids.push(row.skill_category_id);
      byType.set(row.demand_type_id, entry);
    }
    return NextResponse.json({ links: [...byType.values()] });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demand-type-skill-groups:', error);
    return NextResponse.json({ links: [] }, { status: 500 });
  }
}

/** PUT /api/demand-type-skill-groups — Master Data → Demand Type → "Skill groups". Super Admin. */
export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const parsed = demandTypeSkillGroupsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { demand_type_id: demandTypeId } = parsed.data;
    const ids = [...new Set(parsed.data.skill_category_ids)];

    const demandType = await prisma.demand_types.findUnique({ where: { id: demandTypeId }, select: { id: true } });
    if (!demandType) return NextResponse.json({ error: 'Demand type not found' }, { status: 404 });
    // Linking an inactive group is allowed (it simply is not offered on the form while
    // inactive); an unknown id is not.
    const groups = await prisma.skill_categories.count({ where: { id: { in: ids } } });
    if (groups !== ids.length) {
      return NextResponse.json({ error: 'One of the skill groups no longer exists' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.demand_type_skill_categories.deleteMany({ where: { demand_type_id: demandTypeId } }),
      prisma.demand_type_skill_categories.createMany({
        data: ids.map((skillCategoryId) => ({ demand_type_id: demandTypeId, skill_category_id: skillCategoryId })),
      }),
    ]);
    return NextResponse.json({ success: true, demand_type_id: demandTypeId, skill_category_ids: ids });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/demand-type-skill-groups:', error);
    return NextResponse.json({ error: 'Failed to save the skill groups' }, { status: 500 });
  }
}
