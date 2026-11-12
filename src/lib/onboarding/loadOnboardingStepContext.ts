import { prisma } from '@/lib/db/prisma';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

/**
 * Loads a step together with its onboarding, demand context and candidate name, after checking
 * the step really belongs to that onboarding (a step id from another onboarding is "not found").
 */
export async function loadOnboardingStepContext(onboardingId: string, stepId: string) {
  const step = await prisma.onboarding_steps.findUnique({ where: { id: stepId } });
  if (!step || step.onboarding_id !== onboardingId) return null;
  const onboarding = await prisma.onboardings.findUnique({
    where: { id: onboardingId },
    select: { id: true, demand_id: true, candidate_id: true, candidates: { select: { full_name: true } } },
  });
  if (!onboarding?.demand_id) return null;
  const demand = await loadDemandContext(onboarding.demand_id);
  if (!demand) return null;
  return { step, onboarding, demand };
}
