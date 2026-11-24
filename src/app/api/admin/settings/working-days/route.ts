import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import { z } from 'zod';

const workingDaySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  working_days: z.number().int().min(0).max(31),
  holidays_count: z.number().int().min(0).max(31).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const targetYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const configs = await prisma.working_days_configs.findMany({
      where: { year: targetYear },
      orderBy: { month: 'asc' },
    });

    // Map all 12 months with defaults for months that don't have records yet
    const configMap = new Map(configs.map((c) => [c.month, c]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const existing = configMap.get(monthNum);
      return {
        id: existing?.id ?? null,
        year: targetYear,
        month: monthNum,
        working_days: existing?.working_days ?? 22,
        holidays_count: existing?.holidays_count ?? 0,
        notes: existing?.notes ?? '',
      };
    });

    return NextResponse.json({ year: targetYear, months });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/admin/settings/working-days:', error);
    return NextResponse.json({ error: 'Failed to load working days' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(['super_admin']);
    const body = await request.json();
    const parsed = workingDaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { year, month, working_days, holidays_count, notes } = parsed.data;

    const record = await prisma.working_days_configs.upsert({
      where: {
        year_month: { year, month },
      },
      create: {
        year,
        month,
        working_days,
        holidays_count,
        notes: notes || null,
      },
      update: {
        working_days,
        holidays_count,
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/admin/settings/working-days:', error);
    return NextResponse.json({ error: 'Failed to save working days' }, { status: 500 });
  }
}
