import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canAccessCandidate, loadCandidateAccessContext } from '@/lib/auth/candidatePermissions';

// GET /api/candidates/[candidateId]/demand-history?exclude_demand_id=
// Every demand this candidate has been (or is) attached to, most recent first — used
// by AddCandidateModal to show prior/active demand history *before* re-adding a
// candidate, so the recruiter can see it's info, not a blocker (per spec: a rejected
// candidate remains eligible for other demands).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { candidateId } = await params;
    const { searchParams } = new URL(request.url);
    const excludeDemandId = searchParams.get('exclude_demand_id') || undefined;

    // Same candidate access rule as the rest of the module. This route names every
    // demand the candidate has touched, so it must not be readable by a recruiter who
    // has no claim on the candidate.
    const access = await loadCandidateAccessContext(candidateId);
    if (!access) {
      return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    }
    if (!canAccessCandidate({ role: currentUser.role, id: currentUser.userId }, access)) {
      return NextResponse.json({ error: 'You do not have permission to access this candidate' }, { status: 403 });
    }

    const history = await prisma.submissions.findMany({
      where: { candidate_id: candidateId, ...(excludeDemandId ? { demand_id: { not: excludeDemandId } } : {}) },
      select: {
        id: true,
        demand_id: true,
        current_status: true,
        is_active: true,
        final_result: true,
        source: true,
        created_at: true,
        updated_at: true,
        demands: { select: { request_id: true, skill_description: true, company_name: true, client_name: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/candidates/[candidateId]/demand-history:', error);
    return NextResponse.json({ history: [] }, { status: 500 });
  }
}
