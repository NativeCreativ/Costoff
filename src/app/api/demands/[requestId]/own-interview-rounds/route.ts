import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { getDemandOwnInterviewRounds } from '@/lib/demandFulfillment/interviewConfig';

// GET /api/demands/[requestId]/own-interview-rounds — feeds the global Interviews & Schedules
// screen's "Interview Round and Mode" field. Deliberately NOT the same data
// GET /api/demands/[requestId]/interview-config returns: that one resolves demand -> company ->
// global -> hardcoded and materializes the result, which is right for the Demand/Pipeline forms
// but wrong here — Interview Round there must be this demand's OWN rounds and nothing else, with
// no silent fallback. Also returns the demand's required skills (technology_stack), the source
// used to skill-match the Candidate field on the same form.
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const rounds = await getDemandOwnInterviewRounds(demand.id);

    return NextResponse.json({
      rounds: rounds.map((r) => ({ id: r.id, name: r.name, mode: r.mode ?? null, round_order: r.round_order, mandatory: r.mandatory })),
      requiredSkills: demand.technology_stack ?? [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/own-interview-rounds:', error);
    return NextResponse.json({ rounds: [], requiredSkills: [] }, { status: 500 });
  }
}
