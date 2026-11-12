import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { DEMAND_WRITE_ROLES } from '@/lib/auth/demandPermissions';
import { applyMapping, resolveDemandImportRow, MAX_IMPORT_ROWS, type DemandImportRowResult } from '@/lib/demands/demandImportService';
import { generateDemandRequestId, isDemandRequestIdTaken, lockDemandRequestIdSequence } from '@/lib/demands/demandRequestId';
import { normalizeDemandRequestId } from '@/lib/demands/demandRequestIdRules';
import { findOrCreateCompanyByName } from '@/lib/companies/companyMaster';
import { isAllowedListId } from '@/lib/settingsListValidation';
import { demandMasterFieldError } from '@/lib/masters/demandFieldValidation';
import type { DemandImportFieldKey } from '@/constants/demandImportFields';

const bulkImportSchema = z.object({
  // Plain string->string map, not z.record(z.enum(...), ...): zod's record-with-enum-key
  // form requires every enum member to be present as a key, which breaks here since
  // optional fields (SPOC, Recruiter(s), etc.) are legitimately absent when unmapped.
  // applyMapping() (demandImportService.ts) safely looks up each known field key and
  // defaults to '' when missing, so an unconstrained string key is sufficient here.
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.string())).min(1, 'No rows to import').max(MAX_IMPORT_ROWS, `Cannot import more than ${MAX_IMPORT_ROWS} rows at once`),
});

// POST /api/demands/bulk-import — Super Admin / Account Manager only (DEMAND_WRITE_ROLES,
// same as manual single-demand creation). Every row is validated and resolved
// independently (same rules as POST /api/demands: validateAmAssignment /
// validateSpocAssignment / DEMAND_RECRUITER_ROLES, keyed by email; currency code /
// compensation type name resolved to their ids) and inserted in its OWN transaction
// (demands + demand_ta_allocations, matching the single-create write shape exactly) —
// one invalid/duplicate row is reported and skipped, never a hard-fail of the whole
// batch, and never a partially-written demand (missing its recruiter allocations).
export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(DEMAND_WRITE_ROLES);
    const body = await request.json();
    const parsed = bulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { mapping, rows } = parsed.data;

    const activeCurrencyIds = (await prisma.compensation_currencies.findMany({ where: { is_active: true }, select: { id: true } })).map((c) => c.id);
    const activeCompensationTypeIds = (await prisma.compensation_types.findMany({ where: { is_active: true }, select: { id: true } })).map((t) => t.id);

    const seenRequestIds = new Set<string>();
    const results: DemandImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const mappedRow = applyMapping(rows[i], mapping as Partial<Record<DemandImportFieldKey, string>>);
      const resolved = await resolveDemandImportRow(mappedRow, { currentUser: { role: currentUser.role, userId: currentUser.userId }, seenRequestIds });

      if ('error' in resolved) {
        results.push({ row: rowNumber, request_id: mappedRow.request_id || undefined, success: false, error: resolved.error });
        continue;
      }

      const { payload, recruiterIds } = resolved;
      try {
        if (payload.compensation_currency_id && !isAllowedListId(payload.compensation_currency_id, undefined, activeCurrencyIds)) {
          throw new Error('Selected currency is inactive');
        }
        if (payload.compensation_type_id && !isAllowedListId(payload.compensation_type_id, undefined, activeCompensationTypeIds)) {
          throw new Error('Selected compensation type is inactive');
        }
        // Same Requirement-ID rule as POST /api/demands: keep the file's value when it
        // supplied one (already checked for duplicates in resolveDemandImportRow against
        // both the DB and earlier rows of this file), otherwise generate a fresh
        // sequential one inside the write transaction, under the same advisory lock, so a
        // concurrent create can't claim the same number.
        const requestedRequestId = normalizeDemandRequestId(payload.request_id ?? '');
        if (requestedRequestId && seenRequestIds.has(requestedRequestId)) {
          throw new Error(`Request ID "${requestedRequestId}" was already used in this file`);
        }
        // Resolve the spreadsheet's Company columns into a Company master record BEFORE the write
        // transaction, reusing an existing company when the normalized name already matches.
        // The import template's Company/Client/Company Email columns are unchanged, so existing
        // spreadsheets keep working — they now also get a real company_id.
        const masterError = await demandMasterFieldError({
          role_category: payload.role_category,
          locations: payload.locations,
        });
        if (masterError) throw new Error(masterError);

        const importCompanyName = payload.company_name?.trim() || payload.client_name?.trim();
        const importCompany = importCompanyName
          ? await findOrCreateCompanyByName(importCompanyName, {
              client_name: payload.client_name,
              email: payload.company_email,
              created_by: currentUser.userId,
              manager: { account_manager_id: null, managed_by: currentUser.userId },
            })
          : null;

        const created = await prisma.$transaction(async (tx) => {
          await lockDemandRequestIdSequence(tx);
          const requestId = requestedRequestId || (await generateDemandRequestId(tx));
          if (seenRequestIds.has(requestId) || (await isDemandRequestIdTaken(requestId, tx))) {
            throw new Error(`Request ID "${requestId}" already exists or is used earlier in this file`);
          }
          seenRequestIds.add(requestId);
          const demand = await tx.demands.create({
            data: {
              request_id: requestId,
              company_id: importCompany?.company.id ?? null,
              client_name: importCompany?.company.client_name || importCompanyName || null,
              job_title: payload.job_title.trim(),
              skill_description: payload.skill_description.trim(),
              role_category: payload.role_category,
              experience_levels: payload.experience_levels,
              technology_stack: payload.required_skills,
              work_mode: payload.work_mode,
              // Imports carry one mode; work_modes is the list the app reads.
              work_modes: payload.work_mode ? [payload.work_mode] : [],
              company_name: importCompany?.company.name || importCompanyName || null,
              company_email: importCompany?.company.email || payload.company_email?.trim() || null,
              contact_profile_id: payload.contact_profile_id,
              spoc_profile_id: payload.spoc_profile_id || null,
              num_positions: payload.num_positions ?? 1,
              status: payload.status,
              priority: payload.priority,
              compensation_currency_id: payload.compensation_currency_id || null,
              compensation_type_id: payload.compensation_type_id || null,
              // Free text — stored exactly as it appeared in the spreadsheet.
              compensation_min: payload.compensation_min == null ? null : String(payload.compensation_min),
              compensation_max: payload.compensation_max == null ? null : String(payload.compensation_max),
              locations: payload.locations,
              created_by: currentUser.userId,
              updated_by: currentUser.userId,
            },
          });
          if (recruiterIds.length > 0) {
            await tx.demand_ta_allocations.createMany({
              data: recruiterIds.map((ta_id) => ({ demand_id: demand.id, ta_id })),
            });
          }
          return demand;
        });
        results.push({ row: rowNumber, request_id: created.request_id, success: true });
      } catch (dbError) {
        results.push({
          row: rowNumber,
          request_id: payload.request_id || undefined,
          success: false,
          error: dbError instanceof Error ? dbError.message : 'Failed to create demand',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: successCount > 0,
      totalRows: rows.length,
      successCount,
      failureCount: results.length - successCount,
      results,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/bulk-import:', error);
    return NextResponse.json({ error: 'Failed to bulk-import demands' }, { status: 500 });
  }
}
