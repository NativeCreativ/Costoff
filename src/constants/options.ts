export const ROLE_CATEGORY_OPTIONS = [
  { value: 'Full Time', label: 'Full Time' },
  { value: 'Part Time', label: 'Part Time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Temporary', label: 'Temporary' },
  { value: 'Internship', label: 'Internship' },
  { value: 'Freelance', label: 'Freelance' },
];

export const COMPANY_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const PRIORITY_OPTIONS = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

export const DEMAND_STATUS_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'Assign', label: 'Assign' },
  { value: 'Sourcing', label: 'Sourcing' },
  { value: 'Shortlist', label: 'Shortlist' },
  { value: 'Selection', label: 'Selection' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Closure', label: 'Closed' },
];

export const WORK_MODE_OPTIONS = [
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Work On Site', label: 'Work On Site' },
];

export const NOTICE_PERIOD_OPTIONS = [
  { value: 'Immediate', label: 'Immediate' },
  { value: '0-15 Days', label: '0-15 Days' },
  { value: '30 Days', label: '30 Days' },
  { value: '60 Days', label: '60 Days' },
  { value: '90 Days', label: '90 Days' },
  { value: '>90 Days', label: '>90 Days' },
  { value: 'On Break', label: 'On break' },
];

export const CANDIDATE_SOURCE_OPTIONS = [
  { value: 'naukri', label: 'Naukri' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'direct', label: 'Direct Portal' },
  { value: 'referral', label: 'Referral' },
  { value: 'headhunt', label: 'HeadHunt' },
  { value: 'database', label: 'Database' },
  { value: 'others', label: 'Others' },
];

export const INTERVIEW_LEVEL_OPTIONS = [
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
  { value: 'L4', label: 'L4' },
  { value: 'Final', label: 'Final' },
];

/** Statuses an interview can be moved TO.
 *
 *  'Scheduled' is deliberately NOT a transition target: it is only the creation state. Each
 *  interview round is its own row/entry (one per round), so "re-scheduling round 2 after
 *  round 1 came back a No-Show" means booking a NEW interview entry via "Schedule Interview",
 *  never flipping an existing row back to Scheduled. */
export const INTERVIEW_STATUS_TRANSITION_OPTIONS = [
  { value: 'Completed', label: 'Completed' },
  { value: 'Candidate No-Show', label: 'Candidate No-Show' },
  { value: 'Client No-Show', label: 'Client No-Show' },
  { value: 'Panel No-Show', label: 'Panel No-Show' },
];

/** The only status that carries a required follow-up: Completed needs a Result. */
export const INTERVIEW_COMPLETED_STATUS = 'Completed';

export const INTERVIEW_STATUS_OPTIONS = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Candidate No-Show', label: 'Candidate No-Show' },
  { value: 'Client No-Show', label: 'Client No-Show' },
  { value: 'Panel No-Show', label: 'Panel No-Show' },
];

/** Result is only ever recorded for a Completed interview — see INTERVIEW_COMPLETED_STATUS. */
export const INTERVIEW_RESULT_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'on_hold', label: 'On Hold' },
];

export const INTERVIEW_LINK_STATUS_OPTIONS = [
  { value: 'Client_Shared', label: 'Client_Shared' },
  { value: 'Link_Sent', label: 'Link_Sent' },
  { value: 'Pending', label: 'Pending' },
];

export const OFFER_STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Declined', label: 'Declined' },
  { value: 'Withdrawn', label: 'Withdrawn' },
];

export const BGV_STATUS_OPTIONS = [
  { value: 'green', label: '✅ Green (Cleared)' },
  { value: 'amber', label: '🟡 Amber (Partial)' },
  { value: 'red', label: '🔴 Red (Failed)' },
  { value: 'in_progress', label: '🔵 In Progress' },
];

export const USER_ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Delivery Head – DH' },
  { value: 'account_manager', label: 'Account Manager – AM' },
  { value: 'spoc', label: 'SPOC' },
  { value: 'hr', label: 'HR' },
  { value: 'ta', label: 'Recruiter – RT' },
  { value: 'viewer', label: 'Viewer' },
];

export const USER_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

/**
 * Short role name for display next to a person's name (timeline entries, header).
 * Deliberately separate from USER_ROLE_OPTIONS[].label, which carries the role
 * abbreviation for dropdowns ("Delivery Head – DH"). Inline here so a timeline
 * reads "Delivery Head · 08-10-2026" rather than the dropdown form.
 */
export const USER_ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Delivery Head',
  account_manager: 'Account Manager',
  spoc: 'SPOC',
  hr: 'HR',
  ta: 'Recruiter',
  viewer: 'Viewer',
};

/** Abbreviated role for tight inline display: "Priya Mehta (AM)", "John (DH)" */
export const USER_ROLE_ABBR: Record<string, string> = {
  super_admin: 'DH',
  account_manager: 'AM',
  spoc: 'SPOC',
  hr: 'HR',
  ta: 'TA',
  viewer: 'Viewer',
};

/** Display label for a role, falling back to the raw role for unknown values. */
export function roleDisplayName(role?: string | null): string | null {
  if (!role) return null;
  return USER_ROLE_DISPLAY[role] ?? role;
}

