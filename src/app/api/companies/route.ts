import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewCompanies, canCreateCompany } from '@/lib/auth/companyPermissions';
import { companySchema, quickCreateCompanySchema, COMPANY_STATUS_VALUES } from '@/components/companies/company.schema';
import { buildSearchWhere } from '@/lib/search';
import { isUniqueViolation } from '@/lib/masters/masterName';
import { createCompanyMaster, findOrCreateCompanyByName, lookupCompanyByName, COMPANY_SEARCH_FIELDS } from '@/lib/companies/companyMaster';
import { CompanyRoundsValidationError, replaceCompanyRounds } from '@/lib/companies/companyInterviewRounds';
import { resolveCompanyManager, CompanyAccountManagerError } from '@/lib/companies/companyManagedBy';
import { companyOwnerFields, omitRelations } from '@/lib/companies/companyOwnerFields';
import { replaceCompanySpocs } from '@/lib/companies/companySpocs';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';

// GET /api/companies — paginated, searchable Company list. Also the source for the Demand
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canViewCompanies(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to view companies' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const { page, pageSize, skip, take } = parsePagination(
      searchParams.get(PAGE_PARAM),
      searchParams.get(PAGE_SIZE_PARAM)
    );

    const where: Prisma.companiesWhereInput = {};
    if (status && (COMPANY_STATUS_VALUES as readonly string[]).includes(status)) {
      where.status = status;
    }
    const searchOr = buildSearchWhere<Prisma.companiesWhereInput>(search, COMPANY_SEARCH_FIELDS);
    if (searchOr) where.OR = searchOr;

    const [companies, total] = await prisma.$transaction([
      prisma.companies.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        include: {
          _count: { select: { demands: true } },
          profiles_companies_created_byToprofiles: { select: { full_name: true } },
          profiles_companies_account_managerToprofiles: { select: { full_name: true, email: true, role: true } },
          profiles_companies_managed_byToprofiles: { select: { id: true, full_name: true, email: true } },
          company_spocs: { orderBy: { sort_order: 'asc' } },
        },
      }),
      prisma.companies.count({ where }),
    ]);

    return NextResponse.json({
      companies: companies.map((row) => ({
        ...omitRelations(row, [
          'profiles_companies_created_byToprofiles',
          'profiles_companies_account_managerToprofiles',
          'profiles_companies_managed_byToprofiles',
        ]),
        created_by_name: row.profiles_companies_created_byToprofiles?.full_name ?? null,
        ...companyOwnerFields(row),
      })),
      ...buildPaginationMeta(total, page, pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/companies:', error);
    return NextResponse.json({ companies: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

// POST /api/companies — create a Company master record.

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canCreateCompany(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to create companies' }, { status: 403 });
    }

    const rawBody = await request.json();
    const isQuick = rawBody?.quick === true;
    const quickManager = { account_manager_id: null as string | null, managed_by: currentUser.userId };

    // Parsed separately rather than as a schema union so each branch keeps its own inferred
    // shape (the full form's optional detail fields simply don't exist on the quick shape).
    if (isQuick) {
      const quick = quickCreateCompanySchema.safeParse({ name: rawBody?.name });
      if (!quick.success) {
        return NextResponse.json({ error: 'Validation failed', details: quick.error.flatten() }, { status: 400 });
      }
      const { company, created } = await findOrCreateCompanyByName(quick.data.name, {
        created_by: currentUser.userId,
        manager: quickManager,
      });
      return NextResponse.json({ company, created, success: true });
    }

    const parsed = companySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name } = parsed.data;
    const existing = await lookupCompanyByName(name);
    if (existing) {
      return NextResponse.json(
        {
          error: `A company named "${existing.name}" already exists.`,
          existingCompany: existing,
        },
        { status: 409 }
      );
    }

    // The company, its optional Account Manager and its INITIAL rounds are written in ONE
    // transaction. Rounds are optional, so an empty/absent list is simply "no company
    // configuration yet" — the company then falls back to the global default, and the first
    // demand that supplies rounds seeds it (see seedCompanyRoundsIfEmpty). Doing all writes
    // together means a rejected value never leaves a half-created company behind.
    let company;
    try {
      // THE owner rule: a real AM wins, otherwise the session's Delivery Head manages the client.
      const { interview_rounds, account_manager_id, spocs } = parsed.data;
      const manager = await resolveCompanyManager(account_manager_id, { userId: currentUser.userId });

      company = await prisma.$transaction(async (tx) => {
        const { interview_rounds: _ignored, spocs: _spocs, ...companyFields } = parsed.data;
        const created = await createCompanyMaster(
          { ...companyFields, manager, created_by: currentUser.userId },
          tx
        );
        if (interview_rounds && interview_rounds.length > 0) {
          await replaceCompanyRounds(created.id, interview_rounds, tx);
        }
        if (spocs) await replaceCompanySpocs(created.id, spocs, tx);
        return created;
      });
    } catch (error) {
      if (error instanceof CompanyRoundsValidationError || error instanceof CompanyAccountManagerError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ company, created: true, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'A company with that name already exists' }, { status: 409 });
    }
    console.error('Error in POST /api/companies:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}