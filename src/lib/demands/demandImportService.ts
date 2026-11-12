import { prisma } from '@/lib/db/prisma';
import { demandApiSchema } from '@/components/demands/demand.schema';
import { DEMAND_IMPORT_FIELDS, guessFieldForHeader, type DemandImportFieldKey } from '@/constants/demandImportFields';
import {
  parseWorkbookBuffer,
  guessFieldMapping,
  splitCommaList,
  applyColumnMapping,
  MAX_IMPORT_ROWS,
  type ParsedWorkbook,
} from '@/lib/bulk/workbook';
import { isDemandRequestIdTaken } from '@/lib/demands/demandRequestId';
import { duplicateDemandRequestIdMessage, normalizeDemandRequestId, validateDemandRequestId } from '@/lib/demands/demandRequestIdRules';

// Workbook reading, the row/size ceilings and header→field matching are shared with the other
// bulk imports — re-exported here so existing importers of this module are unaffected.
export { MAX_IMPORT_ROWS };
export type { ParsedWorkbook };
export { parseWorkbookBuffer };

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// Re-exported so importers keep one import for the shared Request ID rules.
export { validateDemandRequestId };

/** Column-mapping guess for every field, based on the uploaded headers — a starting
 *  point for the UI's mapping step, not a decision; the user confirms/changes it. */
export function guessMapping(headers: string[]): Partial<Record<DemandImportFieldKey, string>> {
  return guessFieldMapping(headers, DEMAND_IMPORT_FIELDS);
}

export interface DemandImportRowResult {
  row: number; // 1-based, matching the uploaded file's data rows (excluding header)
  request_id?: string;
  success: boolean;
  error?: string;
}

interface ResolveContext {
  currentUser: { role: string; userId: string };
  /** request_ids already committed earlier in THIS batch, to catch in-file duplicates
   *  before they'd otherwise silently both succeed (request_id has no DB uniqueness —
   *  see demandImportFields.ts / the route.ts POST handler, confirmed during research). */
  seenRequestIds: Set<string>;
}

function splitList(value: string | undefined): string[] {
  return splitCommaList(value);
}

/** Resolves one mapped row (raw strings) into a demandApiSchema-ready payload, or
 *  returns a human-readable reason it can't be imported. Reuses the exact same
 *  existence/role checks as POST /api/demands (validateAmAssignment /
 *  validateSpocAssignment / DEMAND_RECRUITER_ROLES), just keyed by email instead of id,
 *  and resolves Currency/Compensation Type by their unique code/name instead of id. */
export async function resolveDemandImportRow(
  mappedRow: Record<DemandImportFieldKey, string>,
  ctx: ResolveContext
): Promise<{ payload: ReturnType<typeof demandApiSchema.parse>; recruiterIds: string[] } | { error: string }> {
  const get = (key: DemandImportFieldKey) => (mappedRow[key] ?? '').trim();

  // Same rules as the form and POST /api/demands; a bad row fails alone and the file still imports.
  const rawRequestId = get('request_id');
  const requestIdValidation = validateDemandRequestId(rawRequestId);
  if (!requestIdValidation.ok) {
    return { error: requestIdValidation.error };
  }
  const requestId = requestIdValidation.value;
  if (requestId) {
    // The validator already uppercased, so this set is the case-insensitive "used in this file" ledger.
    if (ctx.seenRequestIds.has(requestId)) {
      return { error: `Request ID "${requestId}" is already used earlier in this file` };
    }
    if (await isDemandRequestIdTaken(requestId)) {
      return { error: duplicateDemandRequestIdMessage(requestId) };
    }
  }

  // Account Manager — required, must be an existing account_manager profile (same rule
  // as validateAmAssignment in src/app/api/demands/route.ts, keyed by email here).
  const amEmail = get('am_email');
  if (!amEmail) return { error: 'Account Manager Email is required' };
  const amProfile = await prisma.profiles.findUnique({ where: { email: amEmail }, select: { id: true, role: true } });
  if (!amProfile || amProfile.role !== 'account_manager') {
    return { error: `Account Manager Email "${amEmail}" is not an existing Account Manager profile` };
  }
  if (ctx.currentUser.role === 'account_manager' && amProfile.id !== ctx.currentUser.userId) {
    return { error: 'Account Managers can only import demands assigned to themselves' };
  }

  // SPOC — optional, must be an existing spoc profile if provided.
  const spocEmail = get('spoc_email');
  let spocId: string | null = null;
  if (spocEmail) {
    const spocProfile = await prisma.profiles.findUnique({ where: { email: spocEmail }, select: { id: true, role: true } });
    if (!spocProfile || spocProfile.role !== 'spoc') {
      return { error: `SPOC Email "${spocEmail}" is not an existing SPOC profile` };
    }
    spocId = spocProfile.id;
  }

  // Recruiters — optional, every one must be an existing 'ta' profile (DEMAND_RECRUITER_ROLES).
  const recruiterEmails = splitList(get('recruiter_emails'));
  let recruiterIds: string[] = [];
  if (recruiterEmails.length > 0) {
    const recruiterProfiles = await prisma.profiles.findMany({
      where: { email: { in: recruiterEmails } },
      select: { id: true, email: true, role: true },
    });
    const foundEmails = new Set(recruiterProfiles.map((p) => p.email));
    const missing = recruiterEmails.filter((e) => !foundEmails.has(e));
    if (missing.length > 0 || recruiterProfiles.some((p) => p.role !== 'ta')) {
      return { error: 'All Recruiter(s) must be existing Recruiter (TA) profiles' };
    }
    recruiterIds = recruiterProfiles.map((p) => p.id);
  }

  // Currency — optional, resolved by its unique code.
  const currencyCode = get('currency_code');
  let compensationCurrencyId: string | null = null;
  if (currencyCode) {
    const currency = await prisma.compensation_currencies.findUnique({ where: { code: currencyCode }, select: { id: true } });
    if (!currency) return { error: `Currency code "${currencyCode}" was not found` };
    compensationCurrencyId = currency.id;
  }

  // Compensation Type — optional, resolved by its unique name.
  const compTypeName = get('compensation_type_name');
  let compensationTypeId: string | null = null;
  if (compTypeName) {
    const compType = await prisma.compensation_types.findUnique({ where: { name: compTypeName }, select: { id: true } });
    if (!compType) return { error: `Compensation type "${compTypeName}" was not found` };
    compensationTypeId = compType.id;
  }

  const compMinRaw = get('compensation_min');
  const compMaxRaw = get('compensation_max');
  const numPositionsRaw = get('num_positions');

  const candidatePayload = {
    request_id: requestId || undefined,
    client_name: get('client_name'),
    job_title: get('job_title'),
    skill_description: get('skill_description'),
    role_category: get('role_category'),
    priority: get('priority') || 'Medium',
    status: get('status') || 'Assign',
    experience_levels: splitList(get('experience_levels')),
    required_skills: splitList(get('required_skills')),
    work_mode: get('work_mode'),
    compensation_currency_id: compensationCurrencyId,
    compensation_type_id: compensationTypeId,
    // Free text, imported verbatim ("6LPA", "1200000") — never parsed or converted.
    compensation_min: compMinRaw || null,
    compensation_max: compMaxRaw || null,
    locations: splitList(get('locations')),
    num_positions: numPositionsRaw ? Number(numPositionsRaw) : 1,
    company_name: get('company_name'),
    company_email: get('company_email'),
    contact_profile_id: amProfile.id,
    spoc_profile_id: spocId,
    recruiter_ids: recruiterIds,
  };

  if (Number.isNaN(candidatePayload.num_positions) || candidatePayload.num_positions < 1) {
    return { error: 'Positions must be a positive number' };
  }

  const parsed = demandApiSchema.safeParse(candidatePayload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation failed' };
  }

  if (requestId) ctx.seenRequestIds.add(requestId);
  return { payload: parsed.data, recruiterIds };
}

/** Maps a raw uploaded row (keyed by original header) to system field keys, per the
 *  user-confirmed column mapping. Unmapped fields come through as ''. */
export function applyMapping(
  rawRow: Record<string, string>,
  mapping: Partial<Record<DemandImportFieldKey, string>>
): Record<DemandImportFieldKey, string> {
  return applyColumnMapping(rawRow, mapping, DEMAND_IMPORT_FIELDS);
}
