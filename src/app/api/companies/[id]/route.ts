import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewCompanies, canEditCompany } from '@/lib/auth/companyPermissions';
import { companySchema } from '@/components/companies/company.schema';
import { findByNormalizedName, isUniqueViolation } from '@/lib/masters/masterName';
import { resolveCompanyManager, CompanyAccountManagerError } from '@/lib/companies/companyManagedBy';
import { companyOwnerFields, omitRelations } from '@/lib/companies/companyOwnerFields';
import { replaceCompanySpocs } from '@/lib/companies/companySpocs';

/**
 * GET /api/companies/[id] — one Company with its configured interview rounds.
 *
 * There is deliberately NO DELETE handler in this file. A Company is a persistent master
 * referenced by `demands.company_id` (ON DELETE RESTRICT) and by company_interview_rounds;
 * the Company module supports Create / View / Edit / Search only, with no delete action in
 * the API or the UI. See prisma/schema.prisma -> model companies.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    if (!canViewCompanies(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to view companies' }, { status: 403 });
    }
    const { id } = await params;

    const company = await prisma.companies.findUnique({
      where: { id },
      include: {
        company_interview_rounds: {
          orderBy: { round_order: 'asc' },
          include: { interview_rounds: true },
        },
        _count: { select: { demands: true } },
        profiles_companies_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
        profiles_companies_updated_byToprofiles: { select: { id: true, full_name: true, email: true } },
        profiles_companies_account_managerToprofiles: { select: { id: true, full_name: true, email: true, role: true } },
        profiles_companies_managed_byToprofiles: { select: { id: true, full_name: true, email: true } },
        company_spocs: { orderBy: { sort_order: 'asc' } },
      },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const ownerFields = companyOwnerFields(company);
    const legacyFallbackName =
      ownerFields.account_manager_id === null && ownerFields.managed_by_id === null && currentUser.role === 'super_admin'
        ? (await (await import('@/lib/db/prisma')).prisma.profiles.findUnique({
            where: { id: currentUser.userId },
            select: { full_name: true },
          }))?.full_name ?? null
        : null;

    return NextResponse.json({
      company: {
        ...omitRelations(company, [
          'profiles_companies_created_byToprofiles',
          'profiles_companies_updated_byToprofiles',
          'profiles_companies_account_managerToprofiles',
          'profiles_companies_managed_byToprofiles',
        ]),
        created_by_name: company.profiles_companies_created_byToprofiles?.full_name ?? null,
        updated_by_name: company.profiles_companies_updated_byToprofiles?.full_name ?? null,
        ...ownerFields,
        managed_by_fallback_name: legacyFallbackName,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/companies/[id]:', error);
    return NextResponse.json({ error: 'Failed to load company' }, { status: 500 });
  }
}

// PUT /api/companies/[id] — edit a Company. Renaming onto another company's normalized name
// is rejected (409) rather than allowed to collide with the unique index.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    if (!canEditCompany(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to edit companies' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await prisma.companies.findUnique({
      where: { id },
      select: { id: true, account_manager_id: true, managed_by: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    // Rule: an absent AM field keeps the current owner; only an explicit empty/null clears the AM.
    const accountManagerSent = Object.prototype.hasOwnProperty.call(body ?? {}, 'account_manager_id');
    const spocsSent = Object.prototype.hasOwnProperty.call(body ?? {}, 'spocs');
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, client_name, email, phone, website, address, city, state, country, other_details, status, account_manager_id, spocs } = parsed.data;

    const nameOwner = await findByNormalizedName<{ id: string; name: string }>(prisma.companies)(name);
    if (nameOwner && nameOwner.id !== id) {
      return NextResponse.json({ error: `A company named "${name}" already exists` }, { status: 409 });
    }

    // ── Keep the denormalized demand mirrors in sync ──────────────────────────────
    // `demands.client_name` / `company_name` / `company_email` are write-through copies of
    // the company (they are read by the dashboard aging table, Client & Source Analytics,
    // both Excel exports, demand search and the AM mandate email). Without this, renaming or
    // re-contacting a company in the Company module would leave every one of its demands
    // showing the OLD name/email, and Client & Source Analytics would split the company's
    // demands across two client buckets.
    //
    // Both company paths therefore stay in sync: editing here re-propagates, and creating a
    // demand re-mirrors. The update and the propagation run in ONE transaction so a failure
    // can never leave the master and its demands disagreeing.
    //
    // `account_manager_id` is company-only: it is not mirrored onto demands (a demand owns its
    // own AM), so changing it here never touches an existing demand.
    // Omitting the field leaves BOTH owner columns untouched; sending ''/null clears the AM and
    // hands the client to the editing Delivery Head; sending a real AM clears managed_by.
    let manager: { account_manager_id: string | null; managed_by: string | null };
    try {
      manager = accountManagerSent
        ? await resolveCompanyManager(account_manager_id, { userId: currentUser.userId })
        : { account_manager_id: existing.account_manager_id, managed_by: existing.managed_by };
    } catch (error) {
      if (error instanceof CompanyAccountManagerError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const syncedDemands = await prisma.$transaction(async (tx) => {
      const updated = await tx.companies.update({
        where: { id },
        data: {
          name: name.trim(),
          // Client Name is a distinct business label, so clearing it CLEARS it — it is not
          // silently back-filled from the company name (that was what corrupted the master
          // record for quick-created companies). Readers that want a display value fall back
          // themselves; see the demand mirror below and `company.client_name || company.name`
          // in the Company UI.
          client_name: client_name?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          website: website?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          country: country?.trim() || null,
          ...(other_details !== undefined ? { other_details: other_details.trim() || null } : {}),
          status: status ?? 'ACTIVE',
          ...manager,
          updated_by: currentUser.userId,
        },
      });
      if (spocsSent && spocs) await replaceCompanySpocs(id, spocs, tx);
      const mirrored = await tx.demands.updateMany({
        where: { company_id: id },
        data: {
          client_name: updated.client_name || updated.name,
          company_name: updated.name,
          company_email: updated.email,
          updated_by: currentUser.userId,
        },
      });
      return { updated, mirrored: mirrored.count };
    });

    return NextResponse.json({
      company: syncedDemands.updated,
      syncedDemands: syncedDemands.mirrored,
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'A company with that name already exists' }, { status: 409 });
    }
    console.error('Error in PUT /api/companies/[id]:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}