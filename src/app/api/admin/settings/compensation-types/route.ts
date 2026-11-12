import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import { compensationTypeSchema } from '@/components/settings/compensationMaster.schema';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    if (includeInactive) {
      await requireRole(['super_admin']);
    }

    const types = await prisma.compensation_types.findMany({
      where: includeInactive ? undefined : { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    const usageRows = await prisma.demands.groupBy({
      by: ['compensation_type_id'],
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const r of usageRows) {
      if (r.compensation_type_id) counts.set(r.compensation_type_id, r._count._all);
    }

    const withMeta = types.map((t) => ({
      ...t,
      usage: { demands: counts.get(t.id) ?? 0 },
    }));

    return NextResponse.json({ types: withMeta });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/admin/settings/compensation-types:', error);
    return NextResponse.json({ types: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(['super_admin']);
    const body = await request.json();
    const parsed = compensationTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // Case-insensitive — "monthly" vs "Monthly" is still a duplicate to a user, even though
    // the DB's own unique constraint on `name` is case-sensitive.
    const existing = await prisma.compensation_types.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json({ error: `Compensation type "${parsed.data.name}" already exists` }, { status: 409 });
    }

    const max = await prisma.compensation_types.aggregate({ _max: { sort_order: true } });
    const type = await prisma.compensation_types.create({
      data: { ...parsed.data, sort_order: (max._max.sort_order ?? 0) + 1 },
    });
    return NextResponse.json({ type, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/admin/settings/compensation-types:', error);
    return NextResponse.json({ error: 'Failed to create compensation type' }, { status: 500 });
  }
}
