import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { skillCategorySchema } from '@/components/settings/skillsLibrary.schema';

// GET /api/admin/settings/skill-categories — the settings screen's own list, each category with
// its skills. Active-only by default so the picker cache is unaffected; `includeInactive=true`
// additionally returns inactive categories and skills (the settings screen shows them muted).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
    const categories = await prisma.skill_categories.findMany({
      where: includeInactive ? undefined : { is_active: true },
      orderBy: { sort_order: 'asc' },
      include: {
        skills: {
          where: includeInactive ? undefined : { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/admin/settings/skill-categories:', error);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}

// POST /api/admin/settings/skill-categories — Super Admin only. Demand Fulfillment Settings'
// "Skills library" admin UI; the read side (any logged-in role) is GET /api/skills-library.
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const parsed = skillCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.skill_categories.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json({ error: `A category named "${parsed.data.name}" already exists` }, { status: 409 });
    }

    const max = await prisma.skill_categories.aggregate({ _max: { sort_order: true } });
    const category = await prisma.skill_categories.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        sort_order: (max._max.sort_order ?? 0) + 1,
      },
      include: { skills: true },
    });
    return NextResponse.json({ category, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/admin/settings/skill-categories:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
