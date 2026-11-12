import { DEMAND_WORK_MODE_VALUES } from '@/components/demands/demand.schema';
import { NOTICE_PERIOD_VALUES, CANDIDATE_SOURCE_VALUES } from '@/components/candidates/candidate.schema';

/**
 * The column set a Candidate bulk-import file can provide, independent of the uploaded
 * file's own header names/order (resolved via a column-mapping step). Client-safe (no
 * Prisma import) — shared by the mapping UI, the template generator, and the backend
 * resolver (`src/lib/candidates/candidateImportService.ts`) so the three can never drift.
 *
 * Mirrors candidateApiSchema (`src/components/candidates/candidate.schema.ts`)
 * field-for-field, plus one extra field not on the form (`request_id`) that optionally
 * links the imported candidate to a Demand's pipeline, same rule as `requestId` in
 * POST /api/candidates (src/app/api/candidates/route.ts).
 */
export type CandidateImportFieldKey =
  | 'full_name'
  | 'email'
  | 'phone'
  | 'alternate_phone'
  | 'current_location'
  | 'preferred_locations'
  | 'current_company'
  | 'current_designation'
  | 'total_experience'
  | 'skills'
  | 'qualification'
  | 'specialization'
  | 'current_ctc'
  | 'expected_ctc'
  | 'available_from'
  | 'availability'
  | 'work_mode'
  | 'linked_url'
  | 'source'
  | 'request_id';

export interface CandidateImportFieldDef {
  key: CandidateImportFieldKey;
  label: string;
  required: boolean;
  /** Case-insensitive header names this field auto-matches against when a file is uploaded. */
  aliases: string[];
  example: string;
  /** Shown next to the column-mapping dropdown and in the template's instructions. */
  hint?: string;
}

export const CANDIDATE_IMPORT_FIELDS: CandidateImportFieldDef[] = [
  { key: 'full_name', label: 'Full Name', required: true, aliases: ['full name', 'name', 'candidate name'], example: 'Ananya Sharma' },
  { key: 'email', label: 'Email', required: true, aliases: ['email', 'email address'], example: 'ananya.sharma@example.com' },
  { key: 'phone', label: 'Phone', required: true, aliases: ['phone', 'phone number', 'mobile', 'mobile number'], example: '9876543210' },
  { key: 'alternate_phone', label: 'Alternate Phone', required: false, aliases: ['alternate phone', 'alternate phone number', 'alt phone'], example: '9876500000' },
  { key: 'current_location', label: 'Current Location', required: false, aliases: ['current location', 'location'], example: 'Bengaluru' },
  { key: 'preferred_locations', label: 'Preferred Location', required: false, aliases: ['preferred location', 'preferred locations'], example: 'Bengaluru, Pune', hint: 'Comma-separated' },
  { key: 'current_company', label: 'Current Company', required: false, aliases: ['current company', 'company'], example: 'Acme Corp' },
  { key: 'current_designation', label: 'Current Designation', required: false, aliases: ['current designation', 'designation', 'job title'], example: 'Senior Software Engineer' },
  { key: 'total_experience', label: 'Total Experience', required: false, aliases: ['total experience', 'experience'], example: '5 years' },
  { key: 'skills', label: 'Key Skills', required: false, aliases: ['key skills', 'skills', 'technology stack'], example: 'React, Node.js, TypeScript', hint: 'Comma-separated' },
  { key: 'qualification', label: 'Qualification', required: false, aliases: ['qualification'], example: 'B.Tech' },
  { key: 'specialization', label: 'Specialization', required: false, aliases: ['specialization'], example: 'Computer Science' },
  { key: 'current_ctc', label: 'Current CTC', required: false, aliases: ['current ctc', 'ctc'], example: '1200000' },
  { key: 'expected_ctc', label: 'Expected CTC', required: false, aliases: ['expected ctc'], example: '1500000' },
  { key: 'available_from', label: 'Available From', required: false, aliases: ['available from', 'availability date'], example: '2026-01-15', hint: 'YYYY-MM-DD' },
  { key: 'availability', label: 'Notice Period', required: false, aliases: ['notice period', 'availability'], example: NOTICE_PERIOD_VALUES[0], hint: `One of: ${NOTICE_PERIOD_VALUES.join(', ')}. Defaults to Immediate` },
  { key: 'work_mode', label: 'Work Mode', required: false, aliases: ['work mode'], example: DEMAND_WORK_MODE_VALUES[0], hint: `One of: ${DEMAND_WORK_MODE_VALUES.join(', ')}` },
  { key: 'linked_url', label: 'LinkedIn URL', required: false, aliases: ['linkedin url', 'linkedin', 'linked url'], example: 'https://linkedin.com/in/ananyasharma' },
  { key: 'source', label: 'Source', required: true, aliases: ['source'], example: CANDIDATE_SOURCE_VALUES[0], hint: `One of: ${CANDIDATE_SOURCE_VALUES.join(', ')}` },
  { key: 'request_id', label: 'Request ID', required: false, aliases: ['request id', 'requirement id', 'req id', 'demand id'], example: 'CSF-2026-1001', hint: 'Leave blank to add to the master pool; must be a demand you are authorized to manage' },
];

/** Case/whitespace-insensitive match of an uploaded header to a field's label/aliases, for auto-mapping a fresh upload before the user confirms it. */
export function guessFieldForHeader(header: string): CandidateImportFieldKey | null {
  const normalized = header.trim().toLowerCase();
  for (const field of CANDIDATE_IMPORT_FIELDS) {
    if (field.label.toLowerCase() === normalized) return field.key;
    if (field.aliases.some((a) => a.toLowerCase() === normalized)) return field.key;
  }
  return null;
}
