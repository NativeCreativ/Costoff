import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewCompanies, canManageCompanyInterviewRounds } from '@/lib/auth/companyPermissions';
import { companyInterviewRoundsSchema } from '@/components/companies/company.schema';
import {
  CompanyRoundsValidationError,
  CompanyRoundInUseError,
  computeCompanyRoundUsage,
  readCompanyRounds,
  replaceCompanyRounds,
  type CompanyRoundInput,
} from '@/lib/companies/companyInterviewRounds';

async function resolveRoundNames(
  entries: { round_id?: string | null; name?: string | null; mode?: string | null; order?: number; mandatory?: boolean; isActive?: boolean }[]
): Promise<CompanyRoundInput[]> {
  const missingName = entries.filter((r) => !r.name?.trim()).map((r) => r.round_id).filter((id): id is string => !!id);
  const namesById = new Map<string, string>();
  if (missingName.length > 0) {
    const masters = await prisma.interview_rounds.findMany({
      where: { id: { in: missingName } },
      select: { id: true, name: true },
    });
    for (const m of masters) namesById.set(m.id, m.name);
  }

  return entries.map((r) => {
    const name = r.name?.trim() || (r.round_id ? namesById.get(r.round_id) : undefined);
    if (!name) {
      throw new CompanyRoundsValidationError('Every interview round needs a name');
    }
    return { round_id: r.round_id ?? null, name, mode: r.mode ?? null, order: r.order, mandatory: !!r.mandatory, isActive: r.isActive !== false };
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    if (!canViewCompanies(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to view companies' }, { status: 403 });
    }
    const { id } = await params;

    const company = await prisma.companies.findUnique({ where: { id }, select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const rounds = await readCompanyRounds(prisma, id);
    const usage = await computeCompanyRoundUsage(prisma, id, rounds);
    const withUsageCounts = rounds.map((r) => ({ ...r, usage: usage[r.round_id] ?? 0, inUse: (usage[r.round_id] ?? 0) > 0 }));

    return NextResponse.json({ rounds: withUsageCounts, hasConfig: rounds.length > 0 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/companies/[id]/interview-rounds:', error);
    return NextResponse.json({ rounds: [], hasConfig: false }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    if (!canManageCompanyInterviewRounds(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to edit company interview rounds' }, { status: 403 });
    }
    const { id } = await params;

    const company = await prisma.companies.findUnique({ where: { id }, select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = companyInterviewRoundsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    let rounds: CompanyRoundInput[];
    try {
      rounds = await resolveRoundNames(parsed.data.rounds);
    } catch (error) {
      if (error instanceof CompanyRoundsValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    try {
      await replaceCompanyRounds(id, rounds);
    } catch (error) {
      if (error instanceof CompanyRoundInUseError) {
        return NextResponse.json({ error: error.message, code: 'ROUND_IN_USE', rounds: error.rounds }, { status: 409 });
      }
      if (error instanceof CompanyRoundsValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const saved = await readCompanyRounds(prisma, id);
    const usage = await computeCompanyRoundUsage(prisma, id, saved);
    const withUsageCounts = saved.map((r) => ({ ...r, usage: usage[r.round_id] ?? 0, inUse: (usage[r.round_id] ?? 0) > 0 }));

    return NextResponse.json({
      rounds: withUsageCounts,
      hasConfig: saved.length > 0,
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CompanyRoundsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error in PUT /api/companies/[id]/interview-rounds:', error);
    return NextResponse.json({ error: 'Failed to update company interview rounds' }, { status: 500 });
  }
}
