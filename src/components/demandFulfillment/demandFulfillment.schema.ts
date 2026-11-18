import { z } from 'zod';
import {
  DEMAND_ASSIGNMENT_ROLE_VALUES,
  SUBMISSION_STATUS_VALUES,
  UNIFIED_SOURCE_VALUES,
  SUBMISSION_EVENT_TYPE_VALUES,
  INTERVIEW_RESULT_VALUES,
  BGV_STATUS_VALUES,
  ALL_DEMAND_STATUS_VALUES,
} from '@/lib/demandFulfillment/constants';
import { INTERVIEW_COMPLETED_STATUS } from '@/constants/options';
import { ONBOARDING_STEP_STATUS_VALUES } from '@/lib/onboarding/onboardingSteps';

/** Every write endpoint in this module accepts an optional remark, per the client requirement. */
const remarkField = z.string().trim().optional();
const mandatoryRemarkField = z.string().trim().min(1, 'A remark is required for this action');

/** YYYY-MM-DD date-only string, as sent by an HTML date input. Rejects empty strings and non-date garbage. */
export const dateOnlyField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date');

/** HH:MM time-only string, as sent by an HTML time input. Every call site chains
 *  `.optional()` onto this expecting an empty string (an HTML time input left blank, or
 *  Start/End Time being optional fields) to be accepted as "not provided" — so the empty
 *  string is allowed here directly, rather than relying on `.optional()` alone, which only
 *  tolerates `undefined` and would otherwise reject `''` against the HH:MM regex. */
export const timeOnlyField = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a valid time (HH:MM)')
  .or(z.literal(''));

/* ─────────────── Demand assignment ─────────────── */
export const demandAssignmentEntrySchema = z.object({
  user_id: z.string().uuid(),
  role_in_demand: z.enum(DEMAND_ASSIGNMENT_ROLE_VALUES),
});

export const demandAssignSchema = z.object({
  assignments: z.array(demandAssignmentEntrySchema).default([]),
  /** Roles to clear. Omitting a role leaves it unchanged. `recruiter` with an empty recruiter list removes every TA. */
  clear_roles: z.array(z.enum(DEMAND_ASSIGNMENT_ROLE_VALUES)).optional(),
  /** Full set of client (company) SPOC ids. Omit to leave them unchanged. `[]` clears them. */
  client_spoc_ids: z.array(z.string().uuid()).optional(),
  remark: remarkField,
});
export type DemandAssignValues = z.infer<typeof demandAssignSchema>;

/* ─────────────── Demand status transitions ─────────────── */
// 'Resume' is a synthetic target accepted only by PATCH /api/demands/[id]/status,
// which resolves it to the status the demand held before its last "On Hold" event.
const DEMAND_STATUS_INPUT_VALUES = [...ALL_DEMAND_STATUS_VALUES, 'Resume'] as unknown as [string, ...string[]];

export const demandStatusChangeSchema = z
  .object({
    to_status: z.enum(DEMAND_STATUS_INPUT_VALUES),
    remark: remarkField,
  })
  .superRefine((val, ctx) => {
    if (!val.remark && requiresRemarkForDemandStatus(val.to_status)) {
      ctx.addIssue({ code: 'custom', path: ['remark'], message: 'A remark is required for this status change' });
    }
  });
export type DemandStatusChangeValues = z.infer<typeof demandStatusChangeSchema>;

// Kept as a plain function (not imported from constants) to avoid a circular schema/constants
// dependency; the actual reversal check (which needs current status) happens service-side.
function requiresRemarkForDemandStatus(status: string): boolean {
  return status === 'On Hold' || status === 'Cancelled';
}

export const demandCloseSchema = z.object({
  closure_feedback: z.string().trim().min(1, 'Closure feedback is required'),
  remark: remarkField,
});
export type DemandCloseValues = z.infer<typeof demandCloseSchema>;

/* ─────────────── Candidate pipeline (submissions) ─────────────── */
export const addDemandCandidateSchema = z.object({
  candidate_id: z.string().uuid().optional(),
  new_candidate_data: z
    .object({
      full_name: z.string().trim().min(1),
      email: z.string().trim().email().optional().or(z.literal('')),
      phone: z.string().trim().min(1).optional(),
      skills: z.array(z.string()).optional(),
    })
    .optional(),
  source: z.enum(UNIFIED_SOURCE_VALUES).optional(),
  position_slot: z.number().int().positive().optional(),
  remark: remarkField,
}).refine((v) => !!v.candidate_id || !!v.new_candidate_data, {
  message: 'Either candidate_id or new_candidate_data is required',
  path: ['candidate_id'],
});
export type AddDemandCandidateValues = z.infer<typeof addDemandCandidateSchema>;

export const submissionStatusChangeSchema = z.object({
  to_status: z.enum(SUBMISSION_STATUS_VALUES),
  remark: remarkField,
});
export type SubmissionStatusChangeValues = z.infer<typeof submissionStatusChangeSchema>;

export const submissionEventSchema = z.object({
  event_type: z.enum(SUBMISSION_EVENT_TYPE_VALUES),
  content: z.string().trim().optional(),
  attachment_url: z.string().trim().url().optional().or(z.literal('')),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Next follow-up date, e.g. for a call_log entry ("call again on this date").
  follow_up_at: dateOnlyField.optional().or(z.literal('')),
});
export type SubmissionEventValues = z.infer<typeof submissionEventSchema>;

/* ─────────────── Interview config & scheduling ─────────────── */
export const scheduleInterviewSchema = z.object({
  // The configured round's real id (demand_interview_rounds.id) — never a manually-typed
  // round name/text. Validated server-side against that demand's materialized rounds.
  // Optional. When omitted, the server uses this demand's first round, creating a
  // General round if none has been configured yet.
  round_id: z.string().uuid().optional(),
  scheduled_date: dateOnlyField,
  scheduled_time: timeOnlyField.optional(),
  end_time: timeOnlyField.optional(),
  duration_minutes: z.number().int().positive().optional(),
  // Interview mode is a Super Admin-configurable list, plus the Selection values InPerson and Video.
  mode: z.string().trim().min(1).optional(),
  interview_type: z.enum(['Technical', 'Functional', 'Managerial']).optional(),
  interview_location: z.enum(['Teams', 'Direct_Call']).optional(),
  meeting_link: z.string().trim().url().optional().or(z.literal('')),
  remark: remarkField,
}).refine(
  (v) => !v.scheduled_time || !v.end_time || v.end_time > v.scheduled_time,
  { message: 'End time must be after the start time', path: ['end_time'] }
);
export type ScheduleInterviewValues = z.infer<typeof scheduleInterviewSchema>;

export const updateInterviewSchema = z.object({
  // Any active interview-status master name. The route checks the master (and grandfathers
  // the row's current value); the enum used to live here and rejected newly added statuses.
  status: z.string().trim().min(1).optional(),
  mode: z.string().trim().min(1).optional(),
  interview_type: z.enum(['Technical', 'Functional', 'Managerial']).optional(),
  interview_location: z.enum(['Teams', 'Direct_Call']).optional(),
  feedback: z.string().trim().optional(),
  result: z.enum(INTERVIEW_RESULT_VALUES).optional(),
  // Changing the Interview Round re-points round_id to another of the demand's configured
  // rounds — validated server-side, never a free-typed name.
  round_id: z.string().uuid().optional(),
  scheduled_date: dateOnlyField.optional(),
  scheduled_time: timeOnlyField.optional(),
  end_time: timeOnlyField.optional(),
  // Auto-calculated client-side from scheduled_time/end_time — accepted as a plain value,
  // never independently validated against a business rule beyond being a positive int.
  duration_minutes: z.number().int().positive().nullable().optional(),
  meeting_link: z.string().trim().url().optional().or(z.literal('')),
  remark: remarkField,
}).refine(
  (v) => !v.scheduled_time || !v.end_time || v.end_time > v.scheduled_time,
  { message: 'End time must be after the start time', path: ['end_time'] }
)
// An interview's Result exists ONLY to describe an interview that actually happened, so it
// is bound to the Completed status in both directions: marking an interview Completed must
// carry a result, and a result may never be sent for any other status. Enforced here so
// every writer (the inline panel, the Edit modal and any direct API caller) obeys one rule.
.refine(
  (v) => v.status !== INTERVIEW_COMPLETED_STATUS || !!v.result,
  { message: 'Select a Result when marking an interview Completed', path: ['result'] }
).refine(
  (v) => {
    if (v.result === undefined || !v.status) return true;
    // The original non-result statuses still cannot carry a result. Any other status
    // (including a master row flagged requires_result) is checked again on the server.
    return !['Scheduled', 'Candidate No-Show', 'Client No-Show'].includes(v.status);
  },
  { message: 'A Result can only be recorded when the interview status requires one', path: ['result'] }
);
export type UpdateInterviewValues = z.infer<typeof updateInterviewSchema>;

/* ─────────────── Onboarding ─────────────── */
export const documentChecklistItemSchema = z.object({
  name: z.string().trim().min(1),
  required: z.boolean(),
  received: z.boolean().optional(),
  url: z.string().trim().url().optional().or(z.literal('')),
});

export const updateOnboardingSchema = z.object({
  documents_status: z.array(documentChecklistItemSchema).optional(),
  bgv_status: z.enum(BGV_STATUS_VALUES).optional(),
  bgv_remark: z.string().trim().optional(),
  offer_released_at: dateOnlyField.optional(),
  offer_accepted_at: dateOnlyField.optional(),
  joined_at: dateOnlyField.optional(),
  remark: remarkField,
});
export type UpdateOnboardingValues = z.infer<typeof updateOnboardingSchema>;

export const uploadOnboardingDocumentSchema = z.object({
  name: z.string().trim().min(1),
  url: z.string().trim().url(),
  remark: remarkField,
});
export type UploadOnboardingDocumentValues = z.infer<typeof uploadOnboardingDocumentSchema>;

/* ─────────────── Super Admin settings ─────────────── */

export const superAdminSettingsSchema = z
  .object({
    resume_cap_per_position: z.number().int().positive(),
    onboarding_document_checklist: z.array(z.object({ name: z.string().trim().min(1), required: z.boolean() })),
    bgv_checklist: z.array(z.object({ name: z.string().trim().min(1), required: z.boolean() })),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one setting field is required' });
export type SuperAdminSettingsValues = z.infer<typeof superAdminSettingsSchema>;

/* ─────────────── Mandatory-remark variant, reused where the route enforces it directly ── */
export const mandatoryRemarkSchema = z.object({ remark: mandatoryRemarkField });

/* ─────────────── Onboarding steps (per-client ordered list) ─────────────── */

/** PATCH /api/onboarding/[id]/steps/[stepId] — one step's status and/or remark. */
export const updateOnboardingStepSchema = z.object({
  status: z.enum(ONBOARDING_STEP_STATUS_VALUES).optional(),
  remark: z.string().trim().max(2000).nullable().optional(),
  /** Detach the step's file. The file itself is kept on disk (history). */
  clear_attachment: z.boolean().optional(),
});
export type UpdateOnboardingStepValues = z.infer<typeof updateOnboardingStepSchema>;

/** PUT /api/onboarding-step-templates — a client's (or the default) complete ordered step list. */
export const onboardingStepTemplateListSchema = z.object({
  /** A company id, or null for the default list used by clients without their own. */
  company_id: z.string().uuid().nullable(),
  steps: z
    .array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().max(150, 'Keep step names to 150 characters or fewer'),
        details: z.string().max(2000).nullable().optional(),
        requires_attachment: z.boolean().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .max(100),
});
export type OnboardingStepTemplateListValues = z.infer<typeof onboardingStepTemplateListSchema>;

/**
 * POST /api/demands/[requestId]/candidates/[dcId]/review — the Sourcing review step (review
 * batch 4). submit: TA sends a saved profile to the AM / SPOC (submit_as_active also turns a
 * Backup profile Active, for re-submitting a backup once the client opens submissions).
 * approve / reject: the AM / SPOC decides; a rejection needs a reason and sends the profile back.
 */
export const SOURCING_REVIEW_ACTIONS = ['submit', 'submit_as_active', 'approve', 'reject'] as const;
export const sourcingReviewSchema = z
  .object({
    action: z.enum(SOURCING_REVIEW_ACTIONS),
    remark: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.action !== 'reject' || !!v.remark, { path: ['remark'], message: 'Give a reason for the rejection' });
export type SourcingReviewValues = z.infer<typeof sourcingReviewSchema>;
