/**
 * Contribution report (review batch 5, Nov 2026): what each person did on demands in a date
 * range — calls, Demand Matches, profiles added / submitted, approvals, customer shortlists,
 * interviews scheduled, selections and joinings. Counted from the activity rows themselves
 * (call logs, pipeline entries, status events, interviews), by who did it and when.
 */
export const CONTRIBUTION_METRICS = [
  'calls',
  'demand_matches',
  'profiles_added',
  'submitted',
  'approved',
  'customer_shortlisted',
  'interviews_scheduled',
  'selected',
  'joined',
] as const;
export type ContributionMetric = (typeof CONTRIBUTION_METRICS)[number];

export const CONTRIBUTION_LABELS: Record<ContributionMetric, string> = {
  calls: 'Calls',
  demand_matches: 'Demand matches',
  profiles_added: 'Profiles added',
  submitted: 'Submitted',
  approved: 'Approved',
  customer_shortlisted: 'Customer shortlisted',
  interviews_scheduled: 'Interviews scheduled',
  selected: 'Selected',
  joined: 'Joined',
};

/** Pipeline status → the metric credited to whoever moved the candidate there. */
export const STATUS_METRIC: Record<string, ContributionMetric> = {
  submitted_to_spoc: 'submitted',
  shortlisted_internal: 'approved',
  customer_shortlisted: 'customer_shortlisted',
  selected: 'selected',
  joined: 'joined',
};

/** Only Super Admin (Delivery Head) sees everyone; everyone else sees their own contribution. */
export function canSeeEveryonesContribution(role?: string | null): boolean {
  return role === 'super_admin';
}

/** Max range so one request stays cheap. */
export const CONTRIBUTION_MAX_DAYS = 366;
