import { DEMAND_EMPLOYMENT_TYPE_VALUES, DEMAND_PRIORITY_VALUES, DEMAND_STATUS_VALUES, DEMAND_WORK_MODE_VALUES } from '@/components/demands/demand.schema';
import { guessFieldForHeader as guessHeaderAgainstFields } from '@/lib/bulk/workbook';
import type { BulkImportFieldDef } from '@/lib/bulk/workbook';
import { DEMAND_REQUEST_ID_HINT } from '@/lib/demands/demandRequestIdRules';

/**
 * The column set a Demand bulk-import file can provide, independent of the uploaded
 * file's own header names/order (resolved via a column-mapping step). Client-safe (no
 * Prisma import) — shared by the mapping UI, the template generator, and the backend
 * resolver (`src/lib/demands/demandImportService.ts`) so the three can never drift.
 *
 * Mirrors demandApiSchema (`src/components/demands/demand.schema.ts`) field-for-field,
 * except where a DB relation needs a human-typeable identifier instead of a raw UUID:
 *   - Account Manager / SPOC / Recruiter(s) -> profile email(s), resolved against
 *     profiles.email (unique) + profiles.role, same rule as validateAmAssignment /
 *     validateSpocAssignment / DEMAND_RECRUITER_ROLES in src/app/api/demands/route.ts.
 *   - Currency -> compensation_currencies.code (unique), Compensation Type ->
 *     compensation_types.name (unique).
 */
export type DemandImportFieldKey =
  | 'request_id'
  | 'client_name'
  | 'company_name'
  | 'company_email'
  | 'am_email'
  | 'spoc_email'
  | 'recruiter_emails'
  | 'job_title'
  | 'skill_description'
  | 'required_skills'
  | 'role_category'
  | 'experience_levels'
  | 'work_mode'
  | 'currency_code'
  | 'compensation_type_name'
  | 'compensation_min'
  | 'compensation_max'
  | 'num_positions'
  | 'status'
  | 'priority'
  | 'locations';

export interface DemandImportFieldDef extends BulkImportFieldDef<DemandImportFieldKey> {}

export const DEMAND_IMPORT_FIELDS: DemandImportFieldDef[] = [
  { key: 'request_id', label: 'Request ID', required: false, aliases: ['request id', 'requirement id', 'req id'], example: 'REQ-1001', hint: `Leave blank to auto-generate. ${DEMAND_REQUEST_ID_HINT} The CSF-YYYY-NNNN format is reserved for auto-generated IDs.` },
  { key: 'client_name', label: 'Client', required: true, aliases: ['client', 'client name'], example: 'Acme Corp' },
  { key: 'company_name', label: 'Company', required: true, aliases: ['company', 'company name'], example: 'Acme Corp Pvt Ltd' },
  { key: 'company_email', label: 'Company Email', required: true, aliases: ['company email', 'client email'], example: 'hiring@acme.com' },
  { key: 'am_email', label: 'Account Manager Email', required: true, aliases: ['account manager', 'account manager email', 'am', 'am email'], example: 'am@costaff.com', hint: 'Must be an existing Account Manager profile' },
  { key: 'spoc_email', label: 'SPOC Email', required: false, aliases: ['spoc', 'spoc email'], example: 'spoc@costaff.com', hint: 'Must be an existing SPOC profile' },
  { key: 'recruiter_emails', label: 'Recruiter(s)', required: false, aliases: ['recruiter', 'recruiters', 'recruiter emails', 'ta', 'ta emails'], example: 'ta1@costaff.com, ta2@costaff.com', hint: 'Comma-separated; each must be an existing Recruiter (TA) profile' },
  { key: 'job_title', label: 'Job Title', required: true, aliases: ['job title', 'title', 'role'], example: 'Senior Full Stack Developer' },
  { key: 'skill_description', label: 'Job Summary', required: true, aliases: ['job summary', 'job description', 'description'], example: 'Build and scale full-stack features...' },
  { key: 'required_skills', label: 'Required Skills', required: false, aliases: ['required skills', 'skills', 'technology stack'], example: 'React, Node.js, TypeScript', hint: 'Comma-separated' },
  { key: 'role_category', label: 'Demand Category', required: true, aliases: ['employment type', 'role category', 'job type', 'demand category'], example: 'FTE', hint: `An active Demand Category. Seeded values include FTE, Contractor, C2H, ${DEMAND_EMPLOYMENT_TYPE_VALUES.join(', ')}` },
  { key: 'experience_levels', label: 'Experience Level', required: false, aliases: ['experience level', 'experience levels', 'experience'], example: '5-8 Years, Fresher', hint: 'Comma-separated' },
  { key: 'work_mode', label: 'Work Mode', required: true, aliases: ['work mode'], example: DEMAND_WORK_MODE_VALUES[0], hint: `One of: ${DEMAND_WORK_MODE_VALUES.join(', ')}` },
  { key: 'currency_code', label: 'Currency', required: false, aliases: ['currency', 'currency code'], example: 'INR', hint: 'Currency code (e.g. INR, USD) configured in Demand Fulfillment Settings' },
  { key: 'compensation_type_name', label: 'Compensation Type', required: false, aliases: ['compensation type', 'comp type'], example: 'Yearly', hint: 'Compensation type name configured in Demand Fulfillment Settings' },
  { key: 'compensation_min', label: 'Minimum Compensation', required: false, aliases: ['minimum compensation', 'min compensation', 'compensation min', 'min comp'], example: '6LPA', hint: 'Free text, stored as typed' },
  { key: 'compensation_max', label: 'Maximum Compensation', required: false, aliases: ['maximum compensation', 'max compensation', 'compensation max', 'max comp'], example: '12LPA', hint: 'Free text, stored as typed' },
  { key: 'num_positions', label: 'Positions', required: false, aliases: ['positions', 'num positions', 'number of positions', 'no. of positions', 'no of positions'], example: '2' },
  { key: 'status', label: 'Status', required: false, aliases: ['status'], example: DEMAND_STATUS_VALUES[0], hint: `One of: ${DEMAND_STATUS_VALUES.join(', ')}. Defaults to Assign` },
  { key: 'priority', label: 'Priority', required: false, aliases: ['priority'], example: DEMAND_PRIORITY_VALUES[1], hint: `One of: ${DEMAND_PRIORITY_VALUES.join(', ')}. Defaults to Medium` },
  { key: 'locations', label: 'Locations', required: false, aliases: ['locations', 'location'], example: 'Bengaluru, Pune', hint: 'Comma-separated' },
];

/** Case/whitespace-insensitive match of an uploaded header to a field's label/aliases, for auto-mapping a fresh upload before the user confirms it. */
export function guessFieldForHeader(header: string): DemandImportFieldKey | null {
  return guessHeaderAgainstFields(header, DEMAND_IMPORT_FIELDS);
}
