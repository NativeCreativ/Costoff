import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { COMPANY_WRITE_ROLES } from '@/lib/auth/companyPermissions';
import { createCompanyMaster } from '@/lib/companies/companyMaster';
import { CompanyRoundsValidationError, replaceCompanyRounds } from '@/lib/companies/companyInterviewRounds';
import {
  applyCompanyMapping,
  resolveCompanyImportRow,
  MAX_IMPORT_ROWS,
  type CompanyImportResult,
  type CompanyImportRowResult,
} from '@/lib/companies/companyImportService';

const bulkImportSchema = z.object({
  // Same shape as the Demand/Candidate imports: a header→field mapping plus the raw rows keyed
  // by their ORIGINAL uploaded header. Deliberately a loose string map so a column the user did
  // not map simply arrives empty instead of failing the parse.
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.string())).min(1, 'No rows to import').max(MAX_IMPORT_ROWS, `Cannot import more than ${MAX_IMPORT_ROWS} rows at once`),
});

/**
 * POST /api/companies/bulk-import — Clients Master bulk create.
 *
 * Every row is resolved and written INDEPENDENTLY: a company that already exists is reported as
 * `skipped` (never overwritten), a row with a bad value is `failed` with the reason, and one
 * bad row never blocks the rest of the file. The company, its SPOC and its initial interview
 * rounds go out in ONE transaction per row, so a company can never be left existing without the
 * rounds typed alongside it — the same shape Add Company uses.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(COMPANY_WRITE_ROLES);

    const body = await request.json();
    const parsed = bulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { mapping, rows } = parsed.data;

    const seenNames = new Set<string>();
    const results: CompanyImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const mappedRow = applyCompanyMapping(rows[i], mapping);

      const outcome = await resolveCompanyImportRow(mappedRow, {
        seenNames,
        currentUserId: currentUser.userId,
      });

      if (outcome.kind === 'skip') {
        results.push({ row: rowNumber, name: mappedRow.name || undefined, status: 'skipped', error: outcome.reason });
        continue;
      }
      if (outcome.kind === 'fail') {
        results.push({ row: rowNumber, name: mappedRow.name || undefined, status: 'failed', error: outcome.reason });
        continue;
      }

      const { company, manager, rounds } = outcome.row;
      try {
        await prisma.$transaction(async (tx) => {
          const created = await createCompanyMaster({ ...company, manager, created_by: currentUser.userId }, tx);
          if (rounds.length > 0) {
            await replaceCompanyRounds(created.id, rounds, tx);
          }
        });
        results.push({ row: rowNumber, name: company.name, status: 'created' });
      } catch (error) {
        // A rejected round (blank name, case-insensitive duplicate) fails THIS row only, and
        // the transaction rolls back so no half-configured company is left behind.
        const reason =
          error instanceof CompanyRoundsValidationError
            ? error.message
            : error instanceof Error
            ? error.message
            : 'Failed to create company';
        results.push({ row: rowNumber, name: company.name, status: 'failed', error: reason });
      }
    }

    const successCount = results.filter((r) => r.status === 'created').length;
    const failureCount = results.filter((r) => r.status === 'failed').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;

    const result: CompanyImportResult = {
      success: successCount > 0,
      totalRows: rows.length,
      successCount,
      failureCount,
      skippedCount,
      results,
    };
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/companies/bulk-import:', error);
    return NextResponse.json({ error: 'Failed to import companies' }, { status: 500 });
  }
}