import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { reorderSchema } from '@/components/settings/compensationMaster.schema';

// PUT /api/admin/settings/compensation-currencies/reorder — persists drag-and-drop order.
// Body: { orderedIds: string[] } — the full list of currency ids in their new display order.
export async function PUT(request: Request) {
  try {
    await requireRole(['super_admin']);
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { orderedIds } = parsed.data;
    const existing = await prisma.compensation_currencies.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((c) => c.id));
    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      return NextResponse.json({ error: 'orderedIds must include every currency exactly once' }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.compensation_currencies.update({ where: { id }, data: { sort_order: index + 1 } })
      )
    );

    const currencies = await prisma.compensation_currencies.findMany({ orderBy: { sort_order: 'asc' } });
    return NextResponse.json({ currencies, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/compensation-currencies/reorder:', error);
    return NextResponse.json({ error: 'Failed to reorder currencies' }, { status: 500 });
  }
}
