import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { CANDIDATE_WRITE_ROLES } from '@/lib/auth/candidatePermissions';
import { applyMapping, resolveCandidateImportRow, MAX_IMPORT_ROWS, type CandidateImportRowResult } from '@/lib/candidates/candidateImportService';
import type { CandidateImportFieldKey } from '@/constants/candidateImportFields';
import { submissionSourceForCandidate } from '@/lib/candidates/candidateSource';

const bulkImportSchema = z.object({
  // Plain string->string map, not z.record(z.enum(...), ...): zod's record-with-enum-key
  // form requires every enum member to be present as a key, which breaks here since
  // optional fields are legitimately absent when unmapped. applyMapping()
  // (candidateImportService.ts) safely looks up each known field key and defaults to ''
  // when missing, so an unconstrained string key is sufficient here.
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.string())).min(1, 'No rows to import').max(MAX_IMPORT_ROWS, `Cannot import more than ${MAX_IMPORT_ROWS} rows at once`),
});

// POST /api/candidates/bulk-import — Super Admin / Recruiter (ta) / Account Manager
// only (CANDIDATE_WRITE_ROLES, same as manual single-candidate creation). Every row is
// validated and resolved independently (same dedupe rule as POST /api/candidates:
// normalizeEmail/normalizePhone against existing candidates, plus in-batch dedupe; same
// demand-link permission/resume-cap rules as POST /api/demands/[requestId]/candidates)
// and inserted in its OWN transaction (candidates + submissions, matching the
// single-create write shape exactly when a Request ID is linked) — one invalid/
// duplicate row is reported and skipped, never a hard-fail of the whole batch.
export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(CANDIDATE_WRITE_ROLES);
    const body = await request.json();
    const parsed = bulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { mapping, rows } = parsed.data;

    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const demandCapByDemandId = new Map<string, { cap: number; current: number }>();
    const results: CandidateImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const mappedRow = applyMapping(rows[i], mapping as Partial<Record<CandidateImportFieldKey, string>>);
      const resolved = await resolveCandidateImportRow(mappedRow, {
        currentUser: { role: currentUser.role, userId: currentUser.userId },
        seenEmails,
        seenPhones,
        demandCapByDemandId,
      });

      if ('error' in resolved) {
        results.push({ row: rowNumber, full_name: mappedRow.full_name || undefined, success: false, isDuplicate: resolved.isDuplicate, error: resolved.error });
        continue;
      }

      const { payload, demandId, isTaActor } = resolved;
      try {
        const newCandidate = {
          full_name: payload.full_name.trim(),
          email: payload.email,
          phone: payload.phone.trim(),
          alternate_phone: payload.alternate_phone?.trim() || null,
          current_location: payload.current_location?.trim() || null,
          preferred_locations: payload.preferred_locations ?? [],
          current_company: payload.current_company?.trim() || null,
          current_designation: payload.current_designation?.trim() || null,
          total_experience: payload.total_experience?.trim() || null,
          skills: payload.skills ?? [],
          qualification: payload.qualification?.trim() || null,
          specialization: payload.specialization?.trim() || null,
          current_ctc: payload.current_ctc ?? null,
          expected_ctc: payload.expected_ctc ?? null,
          available_from: payload.available_from ? new Date(payload.available_from) : null,
          availability: payload.availability || 'Immediate',
          work_mode: payload.work_mode || null,
          linked_url: payload.linked_url || null,
          // Treat 'internal_db' as undefined (legacy value no longer supported)
          // Cast for the check since TypeScript doesn't know 'internal_db' is excluded from the union.
          source: ((payload.source as string) === 'internal_db' || !payload.source) ? undefined : payload.source,
          added_by: currentUser.userId,
          updated_by: currentUser.userId,
        };

        let createdId: string;
        if (demandId) {
          const created = await prisma.$transaction(async (tx) => {
            const candidate = await tx.candidates.create({ data: newCandidate });
            // Use the candidate's source for the pipeline entry (fallback to candidate's source if not provided)
          const candidateSource = newCandidate.source ?? undefined;
          const pipelineSource = submissionSourceForCandidate(candidateSource) ?? undefined;
          await tx.submissions.create({
            data: {
              demand_id: demandId,
              candidate_id: candidate.id,
              source: pipelineSource,
              added_by: currentUser.userId,
              submitted_by_ta: isTaActor ? currentUser.userId : null,
              remarks: 'Candidate created via bulk import',
            },
          });
            return candidate;
          });
          createdId = created.id;
        } else {
          const created = await prisma.candidates.create({ data: newCandidate });
          createdId = created.id;
        }
        results.push({ row: rowNumber, full_name: newCandidate.full_name, success: true });
        void createdId;
      } catch (dbError) {
        results.push({
          row: rowNumber,
          full_name: payload.full_name || undefined,
          success: false,
          error: dbError instanceof Error ? dbError.message : 'Failed to create candidate',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const duplicateCount = results.filter((r) => !r.success && r.isDuplicate).length;
    const failureCount = results.length - successCount - duplicateCount;
    return NextResponse.json({
      success: successCount > 0,
      totalRows: rows.length,
      successCount,
      duplicateCount,
      failureCount,
      results,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/candidates/bulk-import:', error);
    return NextResponse.json({ error: 'Failed to bulk-import candidates' }, { status: 500 });
  }
}
