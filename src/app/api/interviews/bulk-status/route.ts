import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canEditInterview, interviewEditBlockReason } from '@/lib/auth/interviewPermissions';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import {
  INTERVIEW_COMPLETED_STATUS,
  INTERVIEW_RESULT_OPTIONS,
} from '@/constants/options';
import { interviewStatusError, loadInterviewStatuses, statusRequiresResult } from '@/lib/interviewStatuses';

const RESULT_VALUES = INTERVIEW_RESULT_OPTIONS.map((o) => o.value) as [string, ...string[]];

// Transition targets come from the interview-status master (`is_transition`). Scheduled stays
// creation-only because its seeded row has is_transition = false. A result is required only
// when the chosen status is flagged requires_result (seeded on Completed).
const bulkStatusSchema = z.object({
  interview_ids: z.array(z.string().uuid()).min(1, 'Select at least one interview'),
  status: z.string().trim().min(1, 'Select a status'),
  result: z.enum(RESULT_VALUES).optional(),
}).refine(
  (v) => v.status !== INTERVIEW_COMPLETED_STATUS || !!v.result,
  { message: 'Select a Result when marking interviews Completed', path: ['result'] }
);

// PATCH /api/interviews/bulk-status — no remark (unlike the Demand bulk-status route,
// which requires one). Applies the same per-item creator-ownership rule as the single
// PATCH/PUT routes (canEditInterview), and the same per-row STATUS rule (a Completed
// interview cannot be edited, regardless of result). There is no bulk bypass: an ineligible
// interview in the batch is reported as a skip, not a hard-fail of the whole request.
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();
    const parsed = bulkStatusSchema.safeParse(body);
    if (!parsed.success) {
      // Surface the cross-field refine message ("Select a Result when marking interviews
      // Completed") verbatim — the modal shows `error`, so a bare "Validation failed"
      // would leave the user with no idea what is missing.
      const firstIssue = parsed.error.issues[0];
      const message = firstIssue && !firstIssue.path.includes('interview_ids') ? firstIssue.message : 'Validation failed';
      return NextResponse.json({ error: message, details: parsed.error.flatten() }, { status: 400 });
    }
    const { interview_ids, status, result } = parsed.data;
    const statusCatalog = await loadInterviewStatuses(true);
    const statusError = interviewStatusError(status, null, statusCatalog, true);
    if (statusError) return NextResponse.json({ error: statusError }, { status: 400 });
    if (statusRequiresResult(status, statusCatalog) && !result) {
      return NextResponse.json({ error: 'Select a Result when marking interviews with this status' }, { status: 400 });
    }

    const results: { interview_id: string; label?: string; success: boolean; error?: string }[] = [];

    for (const interviewId of interview_ids) {
      const existing = await prisma.interviews.findUnique({
        where: { id: interviewId },
        select: { demand_id: true, created_by: true, status: true, level: true },
      });
      if (!existing) {
        results.push({ interview_id: interviewId, success: false, error: 'Interview not found' });
        continue;
      }
      // Edit eligibility follows THIS interview's own STATUS, regardless of result. Same rule
      // as the single PATCH and as getInterviewRowActions, so a row hidden from the bulk path
      // can't be driven through it — and a candidate's other rounds never factor in.
      if (existing.status === INTERVIEW_COMPLETED_STATUS) {
        results.push({ interview_id: interviewId, label: existing.level ?? undefined, success: false, error: 'A completed interview cannot be edited' });
        continue;
      }
      if (!existing.demand_id) {
        if (currentUser.role !== 'super_admin') {
          results.push({ interview_id: interviewId, success: false, error: 'You do not have permission to manage this interview' });
          continue;
        }
      } else {
        const demand = await loadDemandContext(existing.demand_id);
        if (!demand) {
          results.push({ interview_id: interviewId, success: false, error: 'Demand not found' });
          continue;
        }
        const actor = { role: currentUser.role, id: currentUser.userId };
        const creatorIsRecruiter = (await recruiterProfileIds([existing.created_by])).has(existing.created_by ?? '');
        if (!canEditInterview(actor, demand, demand.recruiterIds, existing.created_by, creatorIsRecruiter)) {
          results.push({
            interview_id: interviewId,
            success: false,
            error: interviewEditBlockReason(actor, demand.recruiterIds, existing.created_by, creatorIsRecruiter) ?? 'You do not have permission to manage this interview',
          });
          continue;
        }
      }

      // The result is written only for Completed, and cleared for every other status, so a
      // bulk move never leaves a stale pass/fail behind.
      const data = {
        status,
        result: statusRequiresResult(status, statusCatalog) ? result! : null,
        updated_by: currentUser.userId,
      };
      await prisma.interviews.update({ where: { id: interviewId }, data });
      results.push({ interview_id: interviewId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ success: successCount > 0, successCount, failureCount: results.length - successCount, results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/interviews/bulk-status:', error);
    return NextResponse.json({ error: 'Failed to bulk-update interview status' }, { status: 500 });
  }
}
