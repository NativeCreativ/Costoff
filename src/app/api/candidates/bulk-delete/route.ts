import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { CANDIDATE_WRITE_ROLES, canEditCandidate, candidateEditBlockReason, loadCandidateAccessContext } from '@/lib/auth/candidatePermissions';
import { findCandidateArchiveBlocker } from '@/lib/lifecycle/archive';

const bulkDeleteSchema = z.object({
  candidate_ids: z.array(z.string().uuid()).min(1, 'Select at least one candidate'),
});

// DELETE /api/candidates/bulk-delete — same ownership rule as the single-candidate
// DELETE route (canEditCandidate), AND the same "not in a live workflow" archive-blocker
// check. An ineligible candidate in the batch is reported, not a hard-fail of the whole
// request. Hard-delete (cascades away submissions/interviews/offers/onboardings), same
// as the single route.
export async function DELETE(request: Request) {
  try {
    const currentUser = await requireRole(CANDIDATE_WRITE_ROLES);
    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { candidate_ids } = parsed.data;

    const results: { candidate_id: string; success: boolean; error?: string }[] = [];

    for (const candidateId of candidate_ids) {
      const access = await loadCandidateAccessContext(candidateId);
      if (!access) {
        results.push({ candidate_id: candidateId, success: false, error: 'Candidate not found' });
        continue;
      }
      const actor = { role: currentUser.role, id: currentUser.userId };
      if (!canEditCandidate(actor, access)) {
        results.push({
          candidate_id: candidateId,
          success: false,
          error: candidateEditBlockReason(actor, access) ?? 'You do not have permission to access this candidate',
        });
        continue;
      }

      const blocker = await findCandidateArchiveBlocker(candidateId);
      if (blocker) {
        results.push({ candidate_id: candidateId, success: false, error: blocker.message });
        continue;
      }

      await prisma.candidates.delete({ where: { id: candidateId } });
      results.push({ candidate_id: candidateId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ success: successCount > 0, successCount, failureCount: results.length - successCount, results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/candidates/bulk-delete:', error);
    return NextResponse.json({ error: 'Failed to bulk-delete candidates' }, { status: 500 });
  }
}
