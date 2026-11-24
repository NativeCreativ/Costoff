/**
 * Shared enums/constants for the Demand Fulfillment workflow (assignment, candidate
 * pipeline, interviews, onboarding, super-admin config). Mirrors the CHECK constraints
 * added in migration 20260923120000_demand_fulfillment_workflow.
 */

/* ─────────────── Demand assignment roles ─────────────── */
export const DEMAND_ASSIGNMENT_ROLE_VALUES = ['account_manager', 'spoc', 'recruiter'] as const;
export type DemandAssignmentRole = (typeof DEMAND_ASSIGNMENT_ROLE_VALUES)[number];

/** Maps a demand_assignments.role_in_demand value to the profiles.role values allowed to fill it. */
export const DEMAND_ASSIGNMENT_ROLE_TO_PROFILE_ROLES: Record<DemandAssignmentRole, string[]> = {
  account_manager: ['account_manager'],
  spoc: ['spoc'],
  recruiter: ['ta'],
};

/* ─────────────── Demand (parent) status state machine ─────────────── */
// Reuses the existing DEMAND_STATUS_VALUES ('Assign' | 'Sourcing' | 'Shortlist' |
// 'Selection' | 'Onboarding' | 'Closure') from demand.schema.ts, plus two side states.
export const DEMAND_SIDE_STATUS_VALUES = ['On Hold', 'Cancelled'] as const;
export type DemandSideStatus = (typeof DEMAND_SIDE_STATUS_VALUES)[number];

export const DEMAND_LIFECYCLE_STATUS_VALUES = ['Open', 'Assign', 'Sourcing', 'Shortlist', 'Selection', 'Onboarding', 'Closure'] as const;
export type DemandLifecycleStatus = (typeof DEMAND_LIFECYCLE_STATUS_VALUES)[number];

export type DemandStatus = DemandLifecycleStatus | DemandSideStatus;
export const ALL_DEMAND_STATUS_VALUES: DemandStatus[] = [...DEMAND_LIFECYCLE_STATUS_VALUES, ...DEMAND_SIDE_STATUS_VALUES];

/** Statuses that require a mandatory (non-empty) remark on transition into them. */
export const DEMAND_STATUS_REQUIRES_REMARK: ReadonlySet<string> = new Set(['On Hold', 'Cancelled']);

export const DEMAND_TERMINAL_STATUS_VALUES = ['Closure', 'Cancelled'] as const;
export type DemandTerminalStatus = (typeof DEMAND_TERMINAL_STATUS_VALUES)[number];


export function isDemandRecruitmentActive(status?: string | null): boolean {
  return !!status && !(DEMAND_TERMINAL_STATUS_VALUES as readonly string[]).includes(status);
}

/* ─────────────── Candidate-in-demand (submission) pipeline state machine ───── */
export const SUBMISSION_STATUS_VALUES = [
  'sourced',
  'submitted_to_spoc',
  'submitted_to_am',
  'shortlisted_internal',
  'sent_to_customer',
  'customer_shortlisted',
  'interview_scheduled',
  'interviewed',
  'selected',
  'shortlist_reject',
  'rejected',
  'offer_released',
  'offer_accepted',
  'onboarding',
  'bgv_pending',
  'bgv_verified',
  'joined',
  'dropped',
  'backed_out',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS_VALUES)[number];

/** Terminal / exit states reachable from *any* stage in the pipeline. */
export const SUBMISSION_TERMINAL_EXIT_STATUSES: SubmissionStatus[] = ['rejected', 'shortlist_reject', 'dropped', 'backed_out'];

/** The "happy path" forward order used to detect forward vs. backward moves (for the mandatory-remark-on-reversal rule). */
export const SUBMISSION_FORWARD_ORDER: SubmissionStatus[] = [
  'sourced',
  'submitted_to_spoc',
  'submitted_to_am',
  'shortlisted_internal',
  'sent_to_customer',
  'customer_shortlisted',
  'interview_scheduled',
  'interviewed',
  'selected',
  'offer_released',
  'offer_accepted',
  'onboarding',
  'bgv_pending',
  'bgv_verified',
  'joined',
];

/** Unified source list used everywhere: Candidate form, Pipeline filter/cards, Add Existing Candidate,
 * Interview Calendar, Exports. 'direct' -> "Direct Portal", 'indeed' added to Candidate form. */
export const UNIFIED_SOURCE_VALUES = ['naukri', 'linkedin', 'indeed', 'direct', 'referral', 'headhunt', 'database', 'others'] as const;
export type UnifiedSource = (typeof UNIFIED_SOURCE_VALUES)[number];

/** @deprecated Use UNIFIED_SOURCE_VALUES. Kept for type compatibility in legacy code. */
export const SUBMISSION_SOURCE_VALUES = UNIFIED_SOURCE_VALUES;
export type SubmissionSource = UnifiedSource;

export const SUBMISSION_FINAL_RESULT_VALUES = ['joined', 'rejected', 'dropped', 'backed_out'] as const;
export type SubmissionFinalResult = (typeof SUBMISSION_FINAL_RESULT_VALUES)[number];

/** Statuses at which the candidate is considered "in onboarding" for demand-status auto-suggestion. */
export const SUBMISSION_ONBOARDING_STATUSES: SubmissionStatus[] = ['onboarding', 'bgv_pending', 'bgv_verified'];

/* ─────────────── Pipeline event types (submission_events.event_type) ───────── */
export const SUBMISSION_EVENT_TYPE_VALUES = [
  'status_change',
  'note',
  'call_log',
  'interview_scheduled',
  'interview_feedback',
  'document_uploaded',
  'bgv_update',
  'remark',
] as const;
export type SubmissionEventType = (typeof SUBMISSION_EVENT_TYPE_VALUES)[number];

/* ─────────────── Interviews ─────────────── */
export const INTERVIEW_RESULT_VALUES = ['pass', 'fail', 'on_hold'] as const;
export type InterviewResult = (typeof INTERVIEW_RESULT_VALUES)[number];

/** Hardcoded fallback when neither a demand-level nor a global interview_rounds_default config exists. */
export const HARDCODED_DEFAULT_INTERVIEW_ROUNDS: { name: string; order: number; mandatory?: boolean; isActive?: boolean }[] = [
  { name: 'Technical', order: 1, mandatory: true },
  { name: 'HR', order: 2, mandatory: true },
];

/** Hardcoded fallback when the interview_mode_options super-admin setting has no rows yet. */
export type InterviewMode = { name: string; isActive: boolean };

export const HARDCODED_DEFAULT_INTERVIEW_MODES: InterviewMode[] = [
  { name: 'Video', isActive: true },
  { name: 'In-Person', isActive: true },
  { name: 'Phone', isActive: true },
  { name: 'Technical Test', isActive: true },
  { name: 'Group Discussion', isActive: true },
];

export function normalizeOnboardingChecklist(input: unknown): Array<{ name: string; required: boolean; isActive: boolean }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : { name: String(item ?? '') }) as { name?: unknown; required?: unknown; isActive?: unknown };
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      if (!name) return null;
      return { name, required: o.required === true, isActive: o.isActive !== false };
    })
    .filter(Boolean) as Array<{ name: string; required: boolean; isActive: boolean }>;
}

export function normalizeBgvChecklist(input: unknown): Array<{ name: string; required: boolean; isActive: boolean }> {
  return normalizeOnboardingChecklist(input);
}

export function normalizeInterviewRoundsDefault(input: unknown): Array<{ name: string; order: number; mandatory: boolean; isActive: boolean }> {
  if (!Array.isArray(input)) return [];
  return input.map((item, idx) => {
    const o = (item && typeof item === 'object' ? item : { name: String(item ?? '') }) as { name?: unknown; order?: unknown; mandatory?: unknown; isActive?: unknown };
    return {
      name: typeof o.name === 'string' ? o.name.trim() : String(o.name ?? '').trim(),
      order: typeof o.order === 'number' ? o.order : idx + 1,
      mandatory: o.mandatory === true,
      isActive: o.isActive !== false,
    };
  }).filter((r) => r.name);
}
export function normalizeInterviewModes(input: unknown): InterviewMode[] {
  if (!Array.isArray(input)) return HARDCODED_DEFAULT_INTERVIEW_MODES;
  const out: InterviewMode[] = [];
  for (const item of input) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (name) out.push({ name, isActive: true });
    } else if (item && typeof item === 'object') {
      const o = item as { name?: unknown; isActive?: unknown };
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      if (name) out.push({ name, isActive: o.isActive !== false });
    }
  }
  return out.length > 0 ? out : HARDCODED_DEFAULT_INTERVIEW_MODES;
}

/* ─────────────── Onboarding / BGV ─────────────── */
export const BGV_STATUS_VALUES = ['pending', 'in_progress', 'verified', 'failed', 'not_required'] as const;
export type OnboardingBgvStatus = (typeof BGV_STATUS_VALUES)[number];

export const CLOSURE_DUE_DAYS = 90;

/* ─────────────── Super Admin settings keys ─────────────── */
export const SUPER_ADMIN_SETTINGS_KEYS = {
  resumeCapPerPosition: 'resume_cap_per_position',
  interviewRoundsDefault: 'interview_rounds_default',
  interviewModeOptions: 'interview_mode_options',
  onboardingDocumentChecklist: 'onboarding_document_checklist',
  bgvChecklist: 'bgv_checklist',
} as const;

/** Active profiles allowed per open position. Overflow uploads are stored as Backup. */
export const DEFAULT_RESUME_CAP_PER_POSITION = 5;

/* ─────────────── Role helpers ─────────────── */
/** 'ta' is this codebase's existing role value for "Recruiter". */
export const RECRUITER_PROFILE_ROLE = 'ta';

/** Demand aging red-flag threshold (days open). Client-safe home; demandAgingQuery re-exports it. */
export const DEMAND_RED_FLAG_DAYS = 30;
