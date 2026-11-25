import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';

/**
 * GET /api/skill-groups — active Skill Groups (Skill Group -> Skill Category -> Skills, review of
 * 18 Nov 2026), for the demand / candidate skills picker. Any signed-in user, like
 * /api/skills-library. Each category carries its group_id there.
 */
export async function GET() {
  try {
    await requireAuth();
    const groups = await prisma.skill_groups.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, sort_order: true, is_active: true },
    });
    return NextResponse.json({ groups });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/skill-groups:', error);
    return NextResponse.json({ groups: [] }, { status: 500 });
  }
}
