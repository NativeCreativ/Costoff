import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { ensureOnboardingSteps } from '@/lib/onboarding/onboardingSteps';

/**
 * GET /api/onboarding/[id]/steps — the candidate's ordered onboarding steps. The first read
 * copies them from the client's step list (ensureOnboardingSteps), so every onboarding —
 * including ones that predate steps — has its own list from then on.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;

    const onboarding = await prisma.onboardings.findUnique({ where: { id }, select: { id: true, demand_id: true } });
    if (!onboarding?.demand_id) return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
    const demand = await loadDemandContext(onboarding.demand_id);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canViewDemand(actor, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    await prisma.$transaction((tx) => ensureOnboardingSteps(tx, id));
    const steps = await prisma.onboarding_steps.findMany({
      where: { onboarding_id: id },
      orderBy: { step_order: 'asc' },
      include: { profiles: { select: { full_name: true } } },
    });

    return NextResponse.json({
      steps: steps.map(({ profiles, ...step }) => ({ ...step, updated_by_name: profiles?.full_name ?? null })),
      can_manage: canManageDemandPipeline(actor, demand, demand.recruiterIds),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/onboarding/[id]/steps:', error);
    return NextResponse.json({ error: 'Failed to load onboarding steps' }, { status: 500 });
  }
}
