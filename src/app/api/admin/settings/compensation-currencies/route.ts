import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import { compensationCurrencySchema } from '@/components/settings/compensationMaster.schema';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (includeInactive) {
      // Permission-gated: only users who can manage settings may see inactive items.
      // requireRole throws AuthError(403) otherwise.
      // Reuse project's permission: super_admin only (matches settings gate).
      await requireRole(['super_admin']);
    }

    const currencies = await prisma.compensation_currencies.findMany({
      where: includeInactive ? undefined : { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    // Grouped usage counts (no N+1)
    const usageRows = await prisma.demands.groupBy({
      by: ['compensation_currency_id'],
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const r of usageRows) {
      if (r.compensation_currency_id) counts.set(r.compensation_currency_id, r._count._all);
    }

    const withMeta = currencies.map((c) => ({
      ...c,
      usage: { demands: counts.get(c.id) ?? 0 },
    }));

    return NextResponse.json({ currencies: withMeta });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/admin/settings/compensation-currencies:', error);
    return NextResponse.json({ currencies: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(['super_admin']);
    const body = await request.json();
    const parsed = compensationCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // Case-insensitive on both code and name — "inr" vs "INR", or a second currency named
    // "indian rupee" under a different code, are both duplicates a user would not expect
    // to be allowed, even though the DB's own unique constraint on `code` is case-sensitive.
    const existingCode = await prisma.compensation_currencies.findFirst({
      where: { code: { equals: parsed.data.code, mode: 'insensitive' } },
    });
    if (existingCode) {
      return NextResponse.json({ error: `Currency code "${parsed.data.code}" already exists` }, { status: 409 });
    }
    const existingName = await prisma.compensation_currencies.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (existingName) {
      return NextResponse.json({ error: `A currency named "${parsed.data.name}" already exists` }, { status: 409 });
    }

    const max = await prisma.compensation_currencies.aggregate({ _max: { sort_order: true } });
    const currency = await prisma.compensation_currencies.create({
      data: { ...parsed.data, sort_order: (max._max.sort_order ?? 0) + 1 },
    });
    return NextResponse.json({ currency, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/admin/settings/compensation-currencies:', error);
    return NextResponse.json({ error: 'Failed to create currency' }, { status: 500 });
  }
}
