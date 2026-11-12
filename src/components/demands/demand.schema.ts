import { z } from 'zod';

export const DEMAND_EMPLOYMENT_TYPE_VALUES = ['Full Time', 'Part Time', 'Contract', 'Temporary', 'Internship', 'Freelance'] as const;
export const DEMAND_PRIORITY_VALUES = ['High', 'Medium', 'Low'] as const;
export const DEMAND_STATUS_VALUES = ['Open', 'Assign', 'Sourcing', 'Shortlist', 'Selection', 'Onboarding', 'Closure'] as const;
export const DEMAND_ENGAGEMENT_VALUES = ['Proactive', 'Active'] as const;
export const DEMAND_WORK_MODE_VALUES = ['Remote', 'Hybrid', 'Work On Site'] as const;
export const DEMAND_CERTIFICATION_TYPES = ['Technical', 'Behavioral', 'Others'] as const;

/** One certification the demand asks for. Stored as JSON on demands.certifications. */
export const demandCertificationSchema = z.object({
  name: z.string().trim().min(1, 'Certification name is required').max(150, 'Keep certification names to 150 characters or fewer'),
  type: z.enum(DEMAND_CERTIFICATION_TYPES, { message: 'Select a certification type' }),
});
export type DemandCertification = z.infer<typeof demandCertificationSchema>;

/** Rejects the same certification twice (case-insensitive name). */
const certificationListSchema = z.array(demandCertificationSchema).max(30).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((c, index) => {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [index, 'name'], message: `"${c.name.trim()}" is already listed` });
    seen.add(key);
  });
});

/** Reads the stored JSON defensively: anything malformed is dropped, never thrown. */
export function toDemandCertifications(value: unknown): DemandCertification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = demandCertificationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Uploaded Customer JD file: a path under /uploads/jd/ returned by POST /api/uploads/jd. */
export const CUSTOMER_JD_FILE_URL_PREFIX = '/uploads/jd/';
/** Same file on the live site, where uploads live in Netlify Blobs (see uploadStorage.ts). */
export const CUSTOMER_JD_BLOB_URL_PREFIX = '/api/files/jd/';

/** Compensation bounds are plain free text — never parsed, never reformatted. The only
 *  constraint is length (the DB column is VARCHAR(50)); "" means "not specified". */
const compensationAmountField = z
  .string()
  .trim()
  .max(50, 'Keep compensation to 50 characters or fewer');

/** Form schema (plain strings); demand.service.ts converts this to demandApiSchema's shape before sending. */
export const demandSchema = z
  .object({
    request_id: z.string(),
    company_id: z.string().min(1, 'Select the Client for this requirement'),
    end_client_id: z.string(),
    job_title: z.string().min(1, 'Job title is required'),
    /** Shown as "Job Summary". The column keeps its historical name. */
    skill_description: z.string().min(1, 'Job summary is required'),
    role_category: z.string().trim().min(1, 'Select a demand category'),
    demand_type: z.string(),
    priority: z.enum(DEMAND_PRIORITY_VALUES, { message: 'Select a valid priority' }),
    status: z.enum(DEMAND_STATUS_VALUES, { message: 'Select a valid status' }),
    engagement_type: z.string(),
    client_demand_id: z.string(),
    intermediary_partner: z.string(),
    customer_jd: z.string(),
    customer_jd_file_url: z.string(),
    customer_jd_file_name: z.string(),
    /** Client-side SPOCs (company_spocs ids) picked for this demand. */
    client_spoc_ids: z.array(z.string()),
    experience_levels: z.array(z.string()),
    total_experience: z.string().trim().max(100, 'Keep this to 100 characters or fewer'),
    relevant_experience: z.string().trim().max(100, 'Keep this to 100 characters or fewer'),
    certifications: certificationListSchema,
    required_skills: z.array(z.string()),
    /** Skills-library category picked in Required Skills ("Full stack developer"). Empty means
     *  "none picked" and stays that way — never inferred from required_skills. Not to be
     *  confused with `role_category`, which is the Employment Type enum. */
    skills_category_id: z.string(),
    work_modes: z.array(z.enum(DEMAND_WORK_MODE_VALUES)).min(1, 'Select at least one work mode'),
    compensation_currency_id: z.string(),
    compensation_type_id: z.string(),
    compensation_min: compensationAmountField,
    compensation_max: compensationAmountField,
    locations: z.array(z.string()),
    num_positions: z.number(),
    contact_profile_id: z.string().min(1, 'Select the Account Manager who spoke with the company'),
    spoc_profile_id: z.string().optional(),
    recruiter_ids: z.array(z.string()),
    interview_rounds: z.string().optional(),
    /** Edit Demand only: true when the user confirmed clearing a previously non-empty rounds
     *  list back to empty — see demand.service.ts's toDemandPayload for how this becomes an
     *  explicit `interview_rounds: []` in the API payload. */
    interview_rounds_cleared: z.boolean().optional(),
  });

export type DemandFormValues = z.infer<typeof demandSchema>;

/** One interview round within a demand's (or company's) configured list. `name` is capped at
 *  100 chars to match the interview_rounds master's DB column. */
const interviewRoundItemSchema = z.object({
  round_id: z.string().uuid().nullable().optional(),
  /**
   * The MATERIALIZED row (`demand_interview_rounds.id`) this entry continues — the stable id the
   * in-use check matches on, and the one `interviews.round_id` points at.
   *
   * `null` is meaningful and distinct from omitted: it means "a round that does not exist yet",
   * which is how a round added in this session — including one deleted and re-added under the
   * same name — is recognised. Omitting the field entirely marks the payload as an older client,
   * which the backend matches leniently on master id / name instead.
   */
  row_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(100, 'Keep round names to 100 characters or fewer'),
  /** Optional free-text interview mode for this round, same max length as the name. */
  mode: z.string().trim().max(100, 'Keep round modes to 100 characters or fewer').nullable().optional(),
  order: z.number().int().positive(),
  mandatory: z.boolean().optional(),
});

/** Rejects two rounds in the same list whose names are identical once trimmed and
 *  lowercased — the same normalization every other round list in this app is unique on. */
const interviewRoundsListSchema = z.array(interviewRoundItemSchema).optional().superRefine((rounds, ctx) => {
  if (!rounds) return;
  const seen = new Set<string>();
  rounds.forEach((round, index) => {
    const key = round.name.trim().toLowerCase();
    if (seen.has(key)) {
      ctx.addIssue({ code: 'custom', path: [index, 'name'], message: `"${round.name.trim()}" is already in this list` });
    }
    seen.add(key);
  });
});


export const demandApiSchema = z.object({
  request_id: z.string().optional(),
  company_id: z.string().uuid().nullable().optional(),
  end_client_id: z.string().uuid().nullable().optional().or(z.literal('')),
  /** Stored as the demand-type master's name. Empty means not set. Checked against the master in the route. */
  demand_type: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  client_name: z.string().optional(),
  company_name: z.string().optional(),
  company_email: z.string().optional(),
  job_title: z.string().min(1, 'Job title is required'),
  skill_description: z.string().min(1, 'Job summary is required'),
  role_category: z.string().trim().min(1, 'Select a demand category').optional(),
  priority: z.enum(DEMAND_PRIORITY_VALUES, { message: 'Select a valid priority' }),
  status: z.enum(DEMAND_STATUS_VALUES, { message: 'Select a valid status' }),
  engagement_type: z.enum(DEMAND_ENGAGEMENT_VALUES).nullable().optional().or(z.literal('')),
  client_demand_id: z.string().trim().max(100).nullable().optional().or(z.literal('')),
  intermediary_partner: z.string().trim().max(255).nullable().optional().or(z.literal('')),
  customer_jd: z.string().trim().max(20000).nullable().optional().or(z.literal('')),
  /** Set together with customer_jd_file_name, or both null/'' to remove the file. Only paths the
   *  upload route produced are accepted, so a demand can never point at an arbitrary URL. */
  customer_jd_file_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === '' || ((v.startsWith(CUSTOMER_JD_FILE_URL_PREFIX) || v.startsWith(CUSTOMER_JD_BLOB_URL_PREFIX)) && !v.includes('..')),
      'Invalid Customer JD file'
    )
    .nullable()
    .optional(),
  customer_jd_file_name: z.string().trim().max(255).nullable().optional(),
  /** Client-side SPOCs for this demand. Checked against the demand's company in the route. */
  client_spoc_ids: z.array(z.string().uuid()).optional(),
  experience_levels: z.array(z.string()).default([]),
  total_experience: z.string().trim().max(100).nullable().optional(),
  relevant_experience: z.string().trim().max(100).nullable().optional(),
  /** Omitted = leave unchanged on update; [] clears. */
  certifications: certificationListSchema.optional(),
  required_skills: z.array(z.string()).default([]),
  /** Optional FK to skill_categories; null/undefined = no category. Existence and is_active are
   *  checked server-side (isAllowedListId), not by this schema. */
  skills_category_id: z.string().uuid().nullable().optional(),
  /** Older clients and imports send the single `work_mode`; the form sends `work_modes`.
   *  The route needs at least one of the two on create (see resolveWorkModes). */
  work_mode: z.enum(DEMAND_WORK_MODE_VALUES, { message: 'Select a valid work mode' }).optional(),
  work_modes: z.array(z.enum(DEMAND_WORK_MODE_VALUES, { message: 'Select a valid work mode' })).optional(),
  compensation_currency_id: z.string().uuid().nullable().optional(),
  compensation_type_id: z.string().uuid().nullable().optional(),
  // Free text, stored verbatim ("6LPA", "5 lakh", "6000"). A number is accepted and
  // stringified so older clients that still send a numeric bound keep working.
  compensation_min: z.union([z.string(), z.number()]).nullable().optional(),
  compensation_max: z.union([z.string(), z.number()]).nullable().optional(),
  locations: z.array(z.string()).default([]),
  num_positions: z.number().optional(),
  contact_profile_id: z.string().min(1, 'Select the Account Manager who spoke with the company'),
  spoc_profile_id: z.string().nullable().optional(),
  recruiter_ids: z.array(z.string()).default([]),
  interview_rounds: interviewRoundsListSchema,
});

export type DemandApiValues = z.infer<typeof demandApiSchema>;

/**
 * The work modes a write should store, de-duplicated in canonical order. `work_modes` wins; a
 * lone `work_mode` (older client, import) becomes a one-item list. `undefined` = neither was
 * sent, so an update leaves the columns alone. The legacy `work_mode` column gets the first mode.
 */
export function resolveWorkModes(values: { work_mode?: string; work_modes?: string[] }): string[] | undefined {
  const raw = values.work_modes ?? (values.work_mode ? [values.work_mode] : undefined);
  if (raw === undefined) return undefined;
  return DEMAND_WORK_MODE_VALUES.filter((mode) => raw.includes(mode));
}

/** A saved demand's work modes for the form. A demand with neither column set (older data)
 *  opens on "Work On Site", the form's long-standing default. */
export function toFormWorkModes(demand: { work_modes?: string[] | null; work_mode?: string | null }): DemandFormValues['work_modes'] {
  const modes = resolveWorkModes({
    work_modes: demand.work_modes && demand.work_modes.length > 0 ? demand.work_modes : undefined,
    work_mode: demand.work_mode ?? undefined,
  });
  return modes && modes.length > 0 ? (modes as DemandFormValues['work_modes']) : ['Work On Site'];
}

/** Display string for a demand's work modes, falling back to the legacy single column. */
export function formatWorkModes(demand: { work_modes?: string[] | null; work_mode?: string | null }): string {
  const modes = demand.work_modes && demand.work_modes.length > 0 ? demand.work_modes : demand.work_mode ? [demand.work_mode] : [];
  return modes.join(', ');
}
