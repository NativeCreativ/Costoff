import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canEditInterview, interviewEditBlockReason } from '@/lib/auth/interviewPermissions';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { INTERVIEW_COMPLETED_STATUS } from '@/constants/options';

const bulkDeleteSchema = z.object({
  interview_ids: z.array(z.string().uuid()).min(1, 'Select at least one interview'),
});

// DELETE /api/interviews/bulk-delete — same ownership rule as the single-interview
// DELETE route (canEditInterview), AND the same per-row STATUS rule (a Completed interview
// can never be deleted, regardless of result). There is no bulk bypass: every id is
// re-checked here and an ineligible one is reported as a skip rather than failing the whole
// request. Hard-delete (permanently removes the row), same as the single route.
export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { interview_ids } = parsed.data;

    const results: { interview_id: string; success: boolean; error?: string }[] = [];

    for (const interviewId of interview_ids) {
      const existing = await prisma.interviews.findUnique({
        where: { id: interviewId },
        select: { demand_id: true, created_by: true, status: true },
      });
      if (!existing) {
        results.push({ interview_id: interviewId, success: false, error: 'Interview not found' });
        continue;
      }

      if (existing.demand_id) {
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
      } else if (currentUser.role !== 'super_admin') {
        results.push({ interview_id: interviewId, success: false, error: 'You do not have permission to manage this interview' });
        continue;
      }

      if (existing.status === INTERVIEW_COMPLETED_STATUS) {
        results.push({ interview_id: interviewId, success: false, error: 'A completed interview cannot be deleted' });
        continue;
      }

      await prisma.interviews.delete({ where: { id: interviewId } });
      results.push({ interview_id: interviewId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ success: successCount > 0, successCount, failureCount: results.length - successCount, results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/interviews/bulk-delete:', error);
    return NextResponse.json({ error: 'Failed to bulk-delete interviews' }, { status: 500 });
  }
}
