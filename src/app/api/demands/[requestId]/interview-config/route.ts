import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { resolveInterviewRounds, countDemandRoundInterviews } from '@/lib/demandFulfillment/interviewConfig';

// GET /api/demands/[requestId]/interview-config — resolved rounds (demand override -> company ->
// global -> hardcoded) plus whether this demand has its own override. Rounds editing itself now
// happens through the Edit Demand form (PUT /api/demands/[requestId]), not a dedicated endpoint —
// this route stays read-only, also feeding the Interview scheduling dropdown.
//
// Each round also carries `interviews_count` and `in_use`, derived from THIS demand's interviews
// only. They exist so the Edit Demand form can disable delete/rename on rounds that are already
// spoken for. They are a UX hint only — the authoritative check runs inside the save transaction
// (see findInUseDemandRoundConflicts), because an interview can be created while the form is open.
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

    const [override, rounds, interviewCounts] = await Promise.all([
      prisma.demand_interview_config.findUnique({ where: { demand_id: demand.id } }),
      resolveInterviewRounds(demand.id),
      countDemandRoundInterviews(demand.id),
    ]);

    return NextResponse.json({
      rounds: rounds.map((r) => {
        const interviews_count = interviewCounts[r.id] ?? 0;
        return { ...r, interviews_count, in_use: interviews_count > 0 };
      }),
      hasOverride: !!override,
      updated_at: override?.updated_at ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/interview-config:', error);
    return NextResponse.json({ rounds: [] }, { status: 500 });
  }
}
