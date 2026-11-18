import { z } from 'zod';
import { CANDIDATE_SOURCE_VALUES, NOTICE_PERIOD_VALUES, isValidPhone } from '@/components/candidates/candidate.schema';

/** "demand_match" was "fit" before review batch 3 (Nov 2026). */
export const CALL_OUTCOME_VALUES = ['demand_match', 'not_fit'] as const;
export type CallOutcome = (typeof CALL_OUTCOME_VALUES)[number];
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = { demand_match: 'Demand Match', not_fit: 'Not fit' };

/** Fitment Fail Reasons offered on a "Not fit" call. "Other" lets the caller type their own. */
export const FITMENT_FAIL_REASONS = [
  'Skills mismatch',
  'Experience mismatch',
  'CTC expectation too high',
  'Notice period too long',
  'Location mismatch',
  'Not interested in the role',
  'Not reachable',
  'Other',
] as const;

/** A candidate first met on this call. Only name + phone are required: callers rarely have more. */
export const callNewCandidateSchema = z.object({
  full_name: z.string().trim().min(1, 'Candidate name is required').max(255),
  phone: z.string().trim().min(1, 'Phone number is required').refine(isValidPhone, 'Enter a valid phone number'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
  current_company: z.string().trim().max(255),
  current_location: z.string().trim().max(255),
  total_experience: z.string().trim().max(100),
  availability: z.enum(NOTICE_PERIOD_VALUES),
  expected_ctc: z.string().refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Expected CTC must be a number'),
  source: z.enum(CANDIDATE_SOURCE_VALUES, { message: 'Select a source' }),
});
export type CallNewCandidate = z.infer<typeof callNewCandidateSchema>;

/**
 * POST /api/demands/[requestId]/call-logs. Exactly one of `candidate_id` (someone already in our
 * database) or `new_candidate`. A "not_fit" call needs a fail reason; "Other" needs the text.
 */
export const callLogSchema = z
  .object({
    candidate_id: z.string().uuid().nullable().optional(),
    new_candidate: callNewCandidateSchema.nullable().optional(),
    outcome: z.enum(CALL_OUTCOME_VALUES, { message: 'Say whether the candidate matches the demand' }),
    fail_reason: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    /** Skill group discussed on the call (skill_categories.id). */
    skill_group_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.candidate_id === !v.new_candidate) {
      ctx.addIssue({ code: 'custom', path: ['candidate_id'], message: 'Pick an existing candidate or enter a new one' });
    }
    if (v.outcome === 'not_fit' && (!v.fail_reason || v.fail_reason === 'Other')) {
      ctx.addIssue({ code: 'custom', path: ['fail_reason'], message: 'Give the fitment fail reason' });
    }
  });
export type CallLogValues = z.infer<typeof callLogSchema>;

/** PUT /api/demands/[requestId]/call-logs/[callId] — edit a logged call (any time, for now). */
export const callLogUpdateSchema = z
  .object({
    outcome: z.enum(CALL_OUTCOME_VALUES, { message: 'Say whether the candidate matches the demand' }),
    fail_reason: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    skill_group_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === 'not_fit' && (!v.fail_reason || v.fail_reason === 'Other')) {
      ctx.addIssue({ code: 'custom', path: ['fail_reason'], message: 'Give the fitment fail reason' });
    }
  });
export type CallLogUpdateValues = z.infer<typeof callLogUpdateSchema>;

/* ─────────────── Instruction Log ─────────────── */

export const INSTRUCTION_SOURCE_VALUES = ['meeting', 'email', 'call', 'other'] as const;
export const INSTRUCTION_SOURCE_LABELS: Record<(typeof INSTRUCTION_SOURCE_VALUES)[number], string> = {
  meeting: 'Customer meeting',
  email: 'Email',
  call: 'Call',
  other: 'Other',
};

export const demandInstructionSchema = z.object({
  source: z.enum(INSTRUCTION_SOURCE_VALUES, { message: 'Select where the instruction came from' }),
  instruction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date'),
  content: z.string().trim().min(1, 'Write the instruction').max(5000, 'Keep this to 5000 characters or fewer'),
});
export type DemandInstructionValues = z.infer<typeof demandInstructionSchema>;
