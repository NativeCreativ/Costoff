import { guessFieldForHeader as guessHeaderAgainstFields } from '@/lib/bulk/workbook';
import type { BulkImportFieldDef } from '@/lib/bulk/workbook';

/**
 * The column set a Company bulk-import file can provide, independent of the uploaded file's own
 * header names/order (resolved via the shared column-mapping step).
 *
 * Mirrors `companyFormSchema` field-for-field, except where the stored value is a relation and a
 * human must type something typeable:
 *   - Account Manager -> profiles.email (unique), resolved against role 'account_manager' — the
 *     same rule the Add Company form applies to `account_manager_id` (see
 *     lib/companies/companyAccountManager.ts).
 *   - Interview Rounds -> one cell, comma-separated `Round|Mode|mandatory` entries (Mode and the
 *     literal `mandatory` flag are both optional), parsed by `parseCompanyRoundsCell` and then
 *     going through the same create-or-reuse-by-name path the form uses.
 */
export type CompanyImportFieldKey =
  | 'name'
  | 'client_name'
  | 'status'
  | 'email'
  | 'phone'
  | 'website'
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'am_email'
  | 'interview_rounds';

export interface CompanyImportFieldDef extends BulkImportFieldDef<CompanyImportFieldKey> {}

const STATUS_EXAMPLE = companyStatusDisplay('ACTIVE');

/** Normalises a typed status to the stored enum. Anything that is not INACTIVE is ACTIVE,
 *  matching the Add Company form's enum default. Callers that need to REJECT an unknown
 *  value check the raw string against ALLOWED_IMPORT_STATUSES first. */
export const ALLOWED_IMPORT_STATUSES = ['active', 'inactive'] as const;

export function companyStatusLabel(value: string): 'ACTIVE' | 'INACTIVE' {
  return value.trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
}

/** The same value as it should appear in a FILE — Title Case, so an exported workbook can be
 *  re-imported unchanged. Inverse of {@link companyStatusLabel}. */
export function companyStatusDisplay(value: string | null): string {
  return companyStatusLabel(value ?? '') === 'INACTIVE' ? 'Inactive' : 'Active';
}

export const COMPANY_IMPORT_FIELDS: CompanyImportFieldDef[] = [
  {
    key: 'name',
    label: 'Client Name',
    required: true,
    aliases: ['company', 'company name', 'name', 'client', 'client name'],
    example: 'Acme Corp Pvt Ltd',
    hint: 'Unique key. Matched case- and whitespace-insensitively — an existing company is skipped, never overwritten',
  },
  { key: 'client_name', label: 'Legacy Client Label', required: false, aliases: ['legacy client label', 'client display name'], example: 'Acme Global' },
  { key: 'status', label: 'Status', required: false, aliases: ['status'], example: STATUS_EXAMPLE, hint: `One of: ${ALLOWED_IMPORT_STATUSES.join(', ')}. Defaults to Active` },
  { key: 'email', label: 'Email', required: false, aliases: ['company email', 'email'], example: 'hiring@acme.com' },
  { key: 'phone', label: 'Phone', required: false, aliases: ['phone', 'phone number'], example: '+91 98765 43210' },
  { key: 'website', label: 'Website', required: false, aliases: ['website', 'url'], example: 'https://acme.com' },
  { key: 'address', label: 'Address', required: false, aliases: ['address'], example: '221B Baker Street' },
  { key: 'city', label: 'City', required: false, aliases: ['city'], example: 'Bengaluru' },
  { key: 'state', label: 'State', required: false, aliases: ['state'], example: 'Karnataka' },
  { key: 'country', label: 'Country', required: false, aliases: ['country'], example: 'India' },
  { key: 'am_email', label: 'Account Manager Email', required: false, aliases: ['am', 'account manager', 'account manager email', 'am email'], example: 'am@costaff.com', hint: 'Must be an existing Account Manager profile' },
  {
    key: 'interview_rounds',
    label: 'Interview Rounds',
    required: false,
    aliases: ['interview rounds', 'rounds'],
    example: 'Technical|Video call|mandatory, HR|Phone, CEO round',
    hint: 'Comma-separated "Round|Mode|mandatory" entries. Mode and the literal "mandatory" flag are both optional',
  },
];

/** Case/whitespace-insensitive header → field match, shared with the other bulk imports. */
export function guessCompanyFieldForHeader(header: string): CompanyImportFieldKey | null {
  return guessHeaderAgainstFields(header, COMPANY_IMPORT_FIELDS);
}