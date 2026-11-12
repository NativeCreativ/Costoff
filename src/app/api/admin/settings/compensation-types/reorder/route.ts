import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { reorderSchema } from '@/components/settings/compensationMaster.schema';

export async function PUT(request: Request) {
  try {
    await requireRole(['super_admin']);
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { orderedIds } = parsed.data;
    const existing = await prisma.compensation_types.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((t) => t.id));
    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      return NextResponse.json({ error: 'orderedIds must include every compensation type exactly once' }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.compensation_types.update({ where: { id }, data: { sort_order: index + 1 } })
      )
    );

    const types = await prisma.compensation_types.findMany({ orderBy: { sort_order: 'asc' } });
    return NextResponse.json({ types, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/compensation-types/reorder:', error);
    return NextResponse.json({ error: 'Failed to reorder compensation types' }, { status: 500 });
  }
}
