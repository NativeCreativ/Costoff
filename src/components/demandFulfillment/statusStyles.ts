import type { SubmissionStatus } from '@/lib/demandFulfillment/constants';

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  sourced: 'Sourced',
  submitted_to_spoc: 'Submitted to SPOC',
  shortlisted_internal: 'Shortlisted (Internal)',
  sent_to_customer: 'Sent to Customer',
  customer_shortlisted: 'Customer Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed',
  selected: 'Selected',
  rejected: 'Rejected',
  offer_released: 'Offer Released',
  offer_accepted: 'Offer Accepted',
  onboarding: 'Onboarding',
  bgv_pending: 'BGV Pending',
  bgv_verified: 'BGV Verified',
  joined: 'Joined',
  dropped: 'Dropped',
  backed_out: 'Backed Out',
};

/** Kanban column order for the Pipeline tab. */
export const PIPELINE_KANBAN_COLUMNS: SubmissionStatus[] = [
  'sourced',
  'submitted_to_spoc',
  'shortlisted_internal',
  'sent_to_customer',
  'customer_shortlisted',
  'interview_scheduled',
  'interviewed',
  'selected',
  'offer_released',
  'offer_accepted',
  'onboarding',
  'joined',
];

export const SUBMISSION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  sourced: { bg: '#f0f9ff', text: '#0369a1' },
  submitted_to_spoc: { bg: '#fef3c7', text: '#92400e' },
  shortlisted_internal: { bg: '#f5f3ff', text: '#7c3aed' },
  sent_to_customer: { bg: '#eff6ff', text: '#1d4ed8' },
  customer_shortlisted: { bg: '#ecfdf5', text: '#065f46' },
  interview_scheduled: { bg: '#fff7ed', text: '#c2410c' },
  interviewed: { bg: '#f0fdf4', text: '#15803d' },
  selected: { bg: '#ecfdf5', text: '#047857' },
  rejected: { bg: '#fef2f2', text: '#991b1b' },
  offer_released: { bg: '#eff6ff', text: '#1d4ed8' },
  offer_accepted: { bg: '#e0f2fe', text: '#0369a1' },
  onboarding: { bg: '#fdf4ff', text: '#a21caf' },
  bgv_pending: { bg: '#fef3c7', text: '#92400e' },
  bgv_verified: { bg: '#dcfce7', text: '#166534' },
  joined: { bg: '#d1fae5', text: '#065f46' },
  dropped: { bg: '#fee2e2', text: '#dc2626' },
  backed_out: { bg: '#fee2e2', text: '#dc2626' },
};

export const DEMAND_LIFECYCLE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Open: { bg: '#ecfdf5', text: '#047857' },
  Assign: { bg: '#f0f9ff', text: '#0369a1' },
  Sourcing: { bg: '#fef3c7', text: '#92400e' },
  Shortlist: { bg: '#f5f3ff', text: '#7c3aed' },
  Selection: { bg: '#ecfdf5', text: '#047857' },
  Onboarding: { bg: '#fdf4ff', text: '#a21caf' },
  Closure: { bg: '#f1f5f9', text: '#64748b' },
  'On Hold': { bg: '#fef3c7', text: '#92400e' },
  Cancelled: { bg: '#fee2e2', text: '#dc2626' },
};

export function submissionStatusLabel(status: string): string {
  return SUBMISSION_STATUS_LABELS[status] || status;
}
