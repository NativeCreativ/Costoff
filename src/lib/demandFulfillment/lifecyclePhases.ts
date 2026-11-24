/** Which submission statuses belong on each lifecycle tab. Selected candidates show on Onboarding. */
export const LIFECYCLE_PHASE_STATUSES = {
  sourcing: ['sourced', 'submitted_to_spoc', 'submitted_to_am'],
  shortlist: ['shortlisted_internal', 'sent_to_customer'],
  selection: ['customer_shortlisted', 'interview_scheduled', 'interviewed'],
  onboarding: ['selected', 'offer_released', 'offer_accepted', 'onboarding', 'bgv_pending', 'bgv_verified', 'joined'],
} as const;

export type LifecyclePhaseId = keyof typeof LIFECYCLE_PHASE_STATUSES;

export function countByPhase(statuses: string[]): Record<LifecyclePhaseId, number> {
  const counts: Record<LifecyclePhaseId, number> = { sourcing: 0, shortlist: 0, selection: 0, onboarding: 0 };
  for (const status of statuses) {
    for (const phase of Object.keys(counts) as LifecyclePhaseId[]) {
      if ((LIFECYCLE_PHASE_STATUSES[phase] as readonly string[]).includes(status)) counts[phase] += 1;
    }
  }
  return counts;
}
