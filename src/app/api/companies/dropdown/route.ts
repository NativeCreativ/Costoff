import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildCompanyScopeWhere, canUseCompanyDropdown } from '@/lib/auth/companyPermissions';
import { buildSearchWhere } from '@/lib/search';
import { COMPANY_SEARCH_FIELDS } from '@/lib/companies/companyMaster';
import { COMPANY_STATUS_VALUES } from '@/components/companies/company.schema';

// GET /api/companies/dropdown — the Add Demand client picker. Separate from GET /api/companies
// (Clients Master, super_admin only) because it is role-scoped: an Account Manager only ever
// sees their OWN clients. The demand write path re-applies the same scope server-side, so a
// tampered company_id cannot attach a demand to another AM's client.
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canUseCompanyDropdown(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to view companies' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: Prisma.companiesWhereInput = {
      ...(buildCompanyScopeWhere({ role: currentUser.role, id: currentUser.userId }) ?? {}),
    };
    if (status && (COMPANY_STATUS_VALUES as readonly string[]).includes(status)) {
      where.status = status;
    }
    const searchOr = buildSearchWhere<Prisma.companiesWhereInput>(search, COMPANY_SEARCH_FIELDS);
    if (searchOr) where.OR = searchOr;

    const companies = await prisma.companies.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 50,
      select: { id: true, name: true, client_name: true, status: true },
    });

    return NextResponse.json({
      companies: companies.map((c) => ({ ...c, client_name: c.client_name ?? null })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/companies/dropdown:', error);
    return NextResponse.json({ companies: [] }, { status: 500 });
  }
}