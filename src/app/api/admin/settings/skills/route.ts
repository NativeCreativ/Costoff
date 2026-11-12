import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { skillSchema } from '@/components/settings/skillsLibrary.schema';

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const parsed = skillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { category_id, name, skill_type, classification_id } = parsed.data;

    const category = await prisma.skill_categories.findUnique({ where: { id: category_id } });
    if (!category) {
      return NextResponse.json({ error: 'Skill group not found' }, { status: 404 });
    }
    if (classification_id) {
      const classification = await prisma.skill_classifications.findUnique({ where: { id: classification_id } });
      if (!classification || !classification.is_active) {
        return NextResponse.json({ error: 'Skill category was not found or is inactive' }, { status: 400 });
      }
    }

    const existing = await prisma.skills.findFirst({
      where: { category_id, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json({ error: `"${name}" is already in this category` }, { status: 409 });
    }

    const max = await prisma.skills.aggregate({ _max: { sort_order: true }, where: { category_id } });
    const skill = await prisma.skills.create({
      data: {
        category_id,
        name,
        skill_type: skill_type ?? 'optional',
        classification_id: classification_id || null,
        sort_order: (max._max.sort_order ?? 0) + 1,
      },
    });
    return NextResponse.json({ skill, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/admin/settings/skills:', error);
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
}
