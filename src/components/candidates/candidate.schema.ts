import { z } from 'zod';
import { DEMAND_WORK_MODE_VALUES } from '@/components/demands/demand.schema';

export const NOTICE_PERIOD_VALUES = ['Immediate', '15 Days', '30 Days', '60 Days'] as const;
export const CANDIDATE_SOURCE_VALUES = ['naukri', 'linkedin', 'indeed', 'direct', 'referral', 'others'] as const;

/** Loose sanity check: digits/spaces/+/-/() only, at least 7 digits — accepts Indian and international formats without over-constraining. */
const PHONE_REGEX = /^[\d\s()+-]+$/;
export function isValidPhone(value: string): boolean {
  const digitCount = (value.match(/\d/g) || []).length;
  return PHONE_REGEX.test(value) && digitCount >= 7;
}

/** Rejects arrays with case-insensitive duplicate entries (Key Skills, Preferred Location). */
function hasNoDuplicates(values: string[]): boolean {
  const seen = new Set(values.map((v) => v.trim().toLowerCase()));
  return seen.size === values.length;
}

const dedupedStringArray = (message: string) => z.array(z.string()).refine(hasNoDuplicates, { message });

/** Wraps an enum for a genuinely OPTIONAL field (e.g. Work Mode): '' and `null` both normalize to
 *  `null` BEFORE the enum check runs, so "not provided" (an empty string from a blank dropdown, a
 *  stored `null`, or the key simply missing) never has to match one of the enum's real values.
 *  Validation against `values` only happens once something non-empty is actually sent — a bad
 *  (non-empty) value still fails exactly like a required enum would. */
function optionalEnumField<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess((v) => (v === '' ? null : v), z.enum(values).nullable().optional());
}

/** Matches a stored value against an enum's options case/whitespace/underscore-insensitively —
 *  e.g. a legacy `work_on_site` or `REMOTE` would still pre-select "Work On Site" / "Remote" in
 *  the dropdown instead of rendering blank. Every current write path already stores the exact
 *  option string, so this is a defensive normalization, not a fix for existing data. */
export function matchEnumOptionLoosely<T extends readonly string[]>(raw: string | null | undefined, options: T): T[number] | '' {
  if (!raw) return '';
  if ((options as readonly string[]).includes(raw)) return raw as T[number];
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, ' ');
  const target = normalize(raw);
  return (options.find((opt) => normalize(opt) === target) as T[number]) ?? '';
}

/** CTC fields are capped at 10 digits (matches FormField's maxDigits={10} in CandidateForm.tsx). */
const MAX_CTC_DIGITS = 10;
const MAX_CTC_VALUE = 10 ** MAX_CTC_DIGITS - 1;

/** Form schema (plain strings); candidate.service.ts converts this to candidateApiSchema's shape before sending. */
export const candidateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().min(1, 'Phone number is required').refine(isValidPhone, 'Enter a valid phone number'),
  alternate_phone: z.string().refine((v) => !v || isValidPhone(v), 'Enter a valid phone number'),
  current_location: z.string(),
  preferred_locations: dedupedStringArray('Duplicate locations are not allowed'),
  current_company: z.string(),
  current_designation: z.string(),
  total_experience: z.string(),
  skills: dedupedStringArray('Duplicate skills are not allowed'),
  // Skills-library category picked in Key Skills. "" = none picked, never inferred from skills.
  skills_category_id: z.string(),
  qualification: z.string(),
  specialization: z.string(),
  current_ctc: z.string().refine((v) => !v || (Number(v) >= 0 && Number(v) <= MAX_CTC_VALUE && !Number.isNaN(Number(v))), `Current CTC must be a non-negative number of at most ${MAX_CTC_DIGITS} digits`),
  expected_ctc: z.string().refine((v) => !v || (Number(v) >= 0 && Number(v) <= MAX_CTC_VALUE && !Number.isNaN(Number(v))), `Expected CTC must be a non-negative number of at most ${MAX_CTC_DIGITS} digits`),
  available_from: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  availability: z.enum(NOTICE_PERIOD_VALUES, { message: 'Select a valid notice period' }),
  work_mode: z.enum(DEMAND_WORK_MODE_VALUES, { message: 'Select a valid work mode' }).or(z.literal('')),
  linked_url: z.string().url('Enter a valid URL').or(z.literal('')),
  source: z.enum(CANDIDATE_SOURCE_VALUES, { message: 'Select a valid source' }),
  /** 'yes' | 'no' in the form (a select); the API takes a boolean. */
  offer_in_hand: z.enum(['yes', 'no']),
  offer_company: z.string().trim().max(255, 'Keep this to 255 characters or fewer'),
  offer_ctc: z.string().refine((v) => !v || (Number(v) >= 0 && Number(v) <= MAX_CTC_VALUE && !Number.isNaN(Number(v))), `Offer CTC must be a non-negative number of at most ${MAX_CTC_DIGITS} digits`),
  offer_doj: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
});
export type CandidateFormValues = z.infer<typeof candidateSchema>;

/** Backend API schema, matching actual DB column types (numbers/dates, not form strings). */
export const candidateApiSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().min(1, 'Phone number is required').refine(isValidPhone, 'Enter a valid phone number'),
  alternate_phone: z.string().optional().refine((v) => !v || isValidPhone(v), 'Enter a valid phone number'),
  current_location: z.string().optional(),
  preferred_locations: dedupedStringArray('Duplicate locations are not allowed').optional(),
  current_company: z.string().optional(),
  current_designation: z.string().optional(),
  total_experience: z.string().optional(),
  skills: dedupedStringArray('Duplicate skills are not allowed').optional(),
  // Optional FK to skill_categories; existence and is_active are checked by the route.
  skills_category_id: z.string().uuid().nullable().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  current_ctc: z.number().nonnegative('Current CTC must be a non-negative number').max(MAX_CTC_VALUE, `Current CTC must be at most ${MAX_CTC_DIGITS} digits`).nullable().optional(),
  expected_ctc: z.number().nonnegative('Expected CTC must be a non-negative number').max(MAX_CTC_VALUE, `Expected CTC must be at most ${MAX_CTC_DIGITS} digits`).nullable().optional(),
  available_from: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Enter a valid date').nullable().optional(),
  availability: z.enum(NOTICE_PERIOD_VALUES).optional(),
  work_mode: optionalEnumField(DEMAND_WORK_MODE_VALUES),
  linked_url: z.string().url('Enter a valid URL').nullable().optional().or(z.literal('')),
  source: z.enum(CANDIDATE_SOURCE_VALUES, { message: 'Select a valid source' }),
  offer_in_hand: z.boolean().optional(),
  offer_company: z.string().trim().max(255).nullable().optional(),
  offer_ctc: z.number().nonnegative('Offer CTC must be a non-negative number').max(MAX_CTC_VALUE, `Offer CTC must be at most ${MAX_CTC_DIGITS} digits`).nullable().optional(),
  offer_doj: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Enter a valid date').nullable().optional(),
});

export type CandidateApiValues = z.infer<typeof candidateApiSchema>;

/** Conversation Log channels. */
export const CANDIDATE_CONVERSATION_CHANNELS = ['call', 'whatsapp', 'email', 'meeting', 'other'] as const;
export const CANDIDATE_CONVERSATION_CHANNEL_LABELS: Record<(typeof CANDIDATE_CONVERSATION_CHANNELS)[number], string> = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Meeting',
  other: 'Other',
};

/** POST /api/candidates/[candidateId]/conversations */
export const candidateConversationSchema = z.object({
  channel: z.enum(CANDIDATE_CONVERSATION_CHANNELS, { message: 'Select how you spoke to the candidate' }),
  content: z.string().trim().min(1, 'Write what was discussed').max(5000, 'Keep this to 5000 characters or fewer'),
  /** Optional: the requirement the conversation was about. Must be one of the candidate's demands. */
  demand_id: z.string().uuid().nullable().optional(),
});
export type CandidateConversationValues = z.infer<typeof candidateConversationSchema>;
