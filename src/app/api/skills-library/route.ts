import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';

// GET /api/skills-library — readable by any authenticated role: SkillsSelector (Demand
// "Required Skills", Candidate "Key Skills") loads this once per form open. Active
// categories only, each with its active skills, both sorted by sort_order.
export async function GET() {
  try {
    await requireAuth();
    const categories = await prisma.skill_categories.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      include: {
        skills: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/skills-library:', error);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
