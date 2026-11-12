import { prisma } from '@/lib/db/prisma';
import { SUBMISSION_ONBOARDING_STATUSES, type DemandLifecycleStatus } from './constants';

/**
 * Computes a *suggested* demand status from the aggregate of its candidates'
 * pipeline states. Purely advisory — the AM always retains manual override
 * (with remark), this never writes anything.
 */
export async function suggestDemandStatus(demandId: string): Promise<DemandLifecycleStatus | null> {
  const active = await prisma.submissions.findMany({
    where: { demand_id: demandId, is_active: true },
    select: { current_status: true },
  });

  if (active.length === 0) return null;

  const statuses = new Set(active.map((s) => s.current_status));

  if (statuses.has('joined')) return 'Closure';
  if ([...statuses].some((s) => SUBMISSION_ONBOARDING_STATUSES.includes(s as any))) return 'Onboarding';
  if (statuses.has('offer_released') || statuses.has('offer_accepted') || statuses.has('selected')) return 'Selection';
  if (statuses.has('customer_shortlisted') || statuses.has('interview_scheduled') || statuses.has('interviewed')) return 'Shortlist';
  if (statuses.has('sent_to_customer') || statuses.has('shortlisted_internal') || statuses.has('submitted_to_spoc')) return 'Sourcing';
  return 'Sourcing';
}

/**
 * Position-slot fill tracking: counts candidates who have reached 'joined' for a demand.
 */
export async function getFilledPositionCount(demandId: string): Promise<number> {
  return prisma.submissions.count({
    where: { demand_id: demandId, current_status: 'joined' },
  });
}
