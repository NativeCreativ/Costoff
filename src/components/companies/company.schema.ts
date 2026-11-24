import { z } from 'zod';
import { clientSpocListSchema } from '@/components/masterData/spoc.schema';

/** Company status values. Mirrors profiles.status's ACTIVE/INACTIVE convention. */
export const COMPANY_STATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;

/** The one Company status that may be used to raise a NEW Demand. */
export const COMPANY_ACTIVE_STATUS = 'ACTIVE';

/** The one Company status that is retired. */
export const COMPANY_INACTIVE_STATUS = 'INACTIVE';

/**
 * Shown against a Company that cannot be selected (currently only ever a Demand's own INACTIVE
 * company, which stays visible so the Demand keeps pointing at the right record).
 */
export const COMPANY_INACTIVE_OPTION_TAG = 'Inactive';

/**
 * May a NEW Demand be created against a Company in this status?
 *
 * This is the ONLY thing Company status controls. It deliberately does NOT gate anything about
 * Demands that already exist against the company: those keep their own `demands.status`
 * lifecycle (see isDemandRecruitmentActive), so marking a company INACTIVE stops new mandates
 * without terminating recruitment already in flight.
 *
 * Shared by the Add/Clone Demand Company dropdown (to hide inactive companies) and by
 * POST /api/demands (to reject a direct API call), so the list the user sees and the rule the
 * server enforces can never disagree.
 */
export function isCompanyActiveForNewDemand(status?: string | null): boolean {
  return (status ?? COMPANY_ACTIVE_STATUS) === COMPANY_ACTIVE_STATUS;
}

/**
 * Company master — full form (Company CRUD module).
 *
 * `name` is the only required field: Demand quick-create ("+ Add Company") collects just
 * the company name and nothing else.
 *
 * Every optional field is optional here (not blank-by-default) because `client_name` must stay
 * distinguishable from the company name: a value that is genuinely absent is stored as NULL, and
 * only a value the caller actually supplied is stored. See `toCompanyCreateData` in
 * lib/companies/companyMaster.ts, which is the single canonical mapping for all create paths.
 * The `demands.client_name` mirror never goes blank — the *demand* write applies the
 * `client_name -> name` display fallback instead, which is where it belongs.
 *
 * Uniqueness is on the NORMALIZED name (LOWER/TRIM) and is enforced by the DB via the
 * functional unique index `companies_normalized_name_key` — zod cannot express it, so the
 * route maps the resulting unique violation to a 409 (same as the compensation-master routes).
 */
export const companySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(255),
  client_name: z.string().trim().max(255).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  website: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100).optional().or(z.literal('')),
  other_details: z.string().trim().max(5000).optional().or(z.literal('')),
  status: z.enum(COMPANY_STATUS_VALUES).optional(),
  max_submissions_per_position: z.number().int().min(1, 'Must be at least 1').optional().nullable(),
  rate_conversion_formula: z.any().optional().nullable(),
  /**
   * Optional company-level Account Manager. A profiles.id whose role is 'account_manager' —
   * validated server-side. Omitted, empty or cleared means "no AM": a company created before
   * this field simply keeps NULL.
   */
  account_manager_id: z.string().uuid().nullable().optional().or(z.literal('')),
  /** Client contacts. Omitted means "leave the saved list alone" on update. */
  spocs: clientSpocListSchema.optional(),
  /**
   * Optional initial interview rounds, saved with the company in ONE transaction (Add Company
   * and its INTERVIEW ROUNDS section). Same item shape as the settings endpoint — trimming,
   * blank/duplicate rejection and the 1..n order are applied server-side by
   * normalizeCompanyRounds, so an omitted field simply means "no company rounds yet" and the
   * company falls back to the global default.
   */
  interview_rounds: z
    .array(
      z.object({
        round_id: z.string().uuid().nullable().optional(),
        name: z.string().trim().max(100, 'Keep round names to 100 characters or fewer').nullable().optional(),
        // Optional free text, same width as the name. There is no global modes list any more.
        mode: z.string().trim().max(100, 'Keep round modes to 100 characters or fewer').nullable().optional(),
        order: z.number().int().positive().optional(),
        mandatory: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .optional(),
});
export type CompanyApiValues = z.infer<typeof companySchema>;

/**
 * Form-side variant, following the project's existing convention (clientSchema, demandSchema):
 * every field is a plain string because react-hook-form always holds a concrete value, empty
 * included. `companySchema` above stays tolerant of absent optional fields for the API.
 */
export const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(255),
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
  phone: z.string().trim().max(50),
  website: z.string().trim().url('Enter a valid URL').or(z.literal('')),
  address: z.string().trim(),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
  country: z.string().trim().max(100),
  other_details: z.string().trim().max(5000, 'Keep this to 5000 characters or fewer'),
  status: z.enum(COMPANY_STATUS_VALUES),
  max_submissions_per_position: z.number().int().min(1, 'Must be at least 1'),
  rate_conversion_formula: z.any().optional().nullable(),
  spocs: clientSpocListSchema,
});
export type CompanyFormSchemaValues = z.infer<typeof companyFormSchema>;

/**
 * Inline quick-create from the Demand form. Intentionally accepts ONLY the company name —
 * everything else can be completed later from the Company CRUD module.
 */
export const quickCreateCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(255),
});
export type QuickCreateCompanyValues = z.infer<typeof quickCreateCompanySchema>;

/**
 * Company interview-round configuration — the payload of the ONLY endpoint that changes a
 * company's existing rounds (Clients Master → Edit Company).
 *
 * A round may be identified by its master id, by its name, or by both (the configurator sends
 * both); the name is what gets stored, re-resolved to a master id by the shared service. Name
 * trimming, blank-name rejection, case-insensitive duplicate rejection and the dense 1..n order
 * are all applied server-side by normalizeCompanyRounds — this schema only enforces the wire
 * shape, so the same rules apply to every caller rather than to the form alone.
 *
 * `rounds: []` is a valid save: it clears the configuration, and the company then falls back to
 * the global default rounds. A round already in use (by one of this company's own demands or a
 * candidate interview) cannot be renamed, have its mode changed, or be removed — enforced by
 * `replaceCompanyRounds`'s in-use guard; reorder, Mandatory and the Active/Inactive toggle stay
 * allowed on it.
 */
export const companyInterviewRoundsSchema = z.object({
  rounds: z.array(
    z.object({
      round_id: z.string().uuid().nullable().optional(),
      name: z.string().trim().max(100, 'Keep round names to 100 characters or fewer').nullable().optional(),
      mode: z.string().trim().max(100, 'Keep round modes to 100 characters or fewer').nullable().optional(),
      order: z.number().int().positive().optional(),
      mandatory: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
  ),
  remark: z.string().trim().max(500).optional().or(z.literal('')),
});
export type CompanyInterviewRoundsValues = z.infer<typeof companyInterviewRoundsSchema>;

/**
 * Interview Round master create. The route REUSES an existing round when the normalized
 * name already exists instead of erroring — so typing " HR " when "hr" exists attaches the
 * existing master rather than creating a duplicate (requirement: reuse, never duplicate).
 */
export const interviewRoundSchema = z.object({
  name: z.string().trim().min(1, 'Round name is required').max(100),
});
export type InterviewRoundValues = z.infer<typeof interviewRoundSchema>;