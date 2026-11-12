import { prisma } from '@/lib/db/prisma';
import { companySchema } from '@/components/companies/company.schema';
import { findByNormalizedName } from '@/lib/masters/masterName';
import { lookupCompanyAccountManagerByEmail } from '@/lib/companies/companyAccountManager';
import { resolveCompanyManager, type CompanyManagerPair } from '@/lib/companies/companyManagedBy';
import { COMPANY_IMPORT_FIELDS, companyStatusLabel, type CompanyImportFieldKey } from '@/constants/companyImportFields';
import {
  applyColumnMapping,
  guessFieldMapping,
  splitCommaList,
  MAX_IMPORT_ROWS,
  parseWorkbookBuffer,
  type ParsedWorkbook,
} from '@/lib/bulk/workbook';

// Shared workbook plumbing — re-exported so the Company parse route mirrors the Demand one.
export { MAX_IMPORT_ROWS, parseWorkbookBuffer };
export type { ParsedWorkbook };

/** Column-mapping guess for every field, from the uploaded headers. */
export function guessCompanyMapping(headers: string[]): Partial<Record<CompanyImportFieldKey, string>> {
  return guessFieldMapping(headers, COMPANY_IMPORT_FIELDS);
}

/**
 * Parses the Interview Rounds cell: comma-separated entries, each `Round|Mode|mandatory`, where
 * `Mode` and the literal `mandatory` flag are both optional — e.g.
 * `"Technical|Video call|mandatory, HR|Phone, CEO round"`. Company-specific (the Demand bulk
 * import has no equivalent column), so this stays out of the shared `lib/bulk/workbook.ts`.
 *
 * Trims every part, drops entries with no name, and de-dupes by round name case-insensitively
 * (first occurrence wins) — the same "don't fail the row over a typo you can just ignore" rule
 * the Company Name duplicate check applies at the row level. Order is the cell's own order;
 * `normalizeCompanyRounds` (called by `replaceCompanyRounds`) re-derives the dense 1..n order.
 */
export function parseCompanyRoundsCell(value: string | undefined): { name: string; mode: string | null; mandatory: boolean }[] {
  const entries = splitCommaList(value);
  const seen = new Set<string>();
  const result: { name: string; mode: string | null; mandatory: boolean }[] = [];
  for (const entry of entries) {
    const [rawName, rawMode, rawMandatory] = entry.split('|');
    const name = (rawName ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const mode = rawMode?.trim() ? rawMode.trim() : null;
    const mandatory = (rawMandatory ?? '').trim().toLowerCase() === 'mandatory';
    result.push({ name, mode, mandatory });
  }
  return result;
}

/** Maps a raw uploaded row (keyed by original header) to company field keys. */
export function applyCompanyMapping(
  rawRow: Record<string, string>,
  mapping: Partial<Record<CompanyImportFieldKey, string>>
): Record<CompanyImportFieldKey, string> {
  return applyColumnMapping(rawRow, mapping, COMPANY_IMPORT_FIELDS);
}

export type CompanyRowStatus = 'created' | 'skipped' | 'failed';

export interface CompanyImportRowResult {
  /** 1-based data-row number in the uploaded file (header excluded). */
  row: number;
  /** The company name from that row, so the summary is readable without opening the file. */
  name?: string;
  status: CompanyRowStatus;
  /** Why the row was skipped or failed. Absent on success. */
  error?: string;
}

export interface CompanyImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: CompanyImportRowResult[];
}

/** Everything one row resolved to, ready for the write. */
export interface ResolvedCompanyImportRow {
  company: {
    name: string;
    client_name: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    city: string;
    state: string;
    country: string;
    status: string;
    account_manager_id: string | null;
  };
  /** The resolved owner pair, so the write reuses the shared rule instead of re-deriving it. */
  manager: CompanyManagerPair;
  /** Rounds as typed (`Round|Mode|mandatory`), already trimmed + de-duplicated by name. */
  rounds: { name: string; mode: string | null; mandatory: boolean }[];
}

type ResolveOutcome =
  | { kind: 'ready'; row: ResolvedCompanyImportRow }
  /** Deliberately not written because the company already exists. Never an error. */
  | { kind: 'skip'; reason: string }
  /** The caller can fix this by editing the row. */
  | { kind: 'fail'; reason: string };

/**
 * Resolves one mapped row into a company payload, or reports why it cannot be imported.
 *
 * Every rule mirrors the Add Company form (`companySchema` + `toCompanyCreateData` +
 * `lookupCompanySpoc` + `replaceCompanyRounds`), so a file and a hand-typed form produce the
 * same record:
 *   - Company Name is the unique key, matched case- and whitespace-insensitively;
 *   - SPOC Email must resolve to an existing profile with the SPOC role;
 *   - email / phone / website are validated by the same schema as the form;
 *   - rounds are `Round|Mode|mandatory` entries, split on commas and de-duplicated by name.
 */
export async function resolveCompanyImportRow(
  mappedRow: Record<CompanyImportFieldKey, string>,
  ctx: { seenNames: Set<string>; currentUserId: string }
): Promise<ResolveOutcome> {
  const get = (key: CompanyImportFieldKey) => (mappedRow[key] ?? '').trim();

  const name = get('name');
  if (!name) return { kind: 'fail', reason: 'Client Name is required' };

  // In-file duplicate: first row wins, later copies are skipped (not failed) so the count of
  // genuinely broken rows stays meaningful.
  const nameKey = name.toLowerCase();
  if (ctx.seenNames.has(nameKey)) {
    return { kind: 'skip', reason: `Duplicate Company Name "${name}" within this file — the first row wins` };
  }

  const existing = await findByNormalizedName<{ id: string; name: string }>(prisma.companies)(name);
  if (existing) {
    return { kind: 'skip', reason: `A company named "${existing.name}" already exists` };
  }

  // Account Manager — optional, must be an existing account_manager profile, same rule as the form.
  // An empty cell resolves to the importing Delivery Head through the same shared helper.
  const amEmail = get('am_email');
  if (amEmail && !(await lookupCompanyAccountManagerByEmail(amEmail))) {
    return { kind: 'fail', reason: `Account Manager Email "${amEmail}" is not an existing Account Manager profile` };
  }
  let manager: CompanyManagerPair;
  try {
    manager = await resolveCompanyManager(
      amEmail ? (await lookupCompanyAccountManagerByEmail(amEmail))?.id : null,
      { userId: ctx.currentUserId }
    );
  } catch {
    return { kind: 'fail', reason: `Account Manager Email "${amEmail}" is not an existing Account Manager profile` };
  }
  const accountManagerId = manager.account_manager_id;

  // Status — unknown values fall back to Active rather than failing the row, matching the
  // form's enum default. Anything that is not INACTIVE is Active.
  const statusRaw = get('status');
  const status = statusRaw ? companyStatusLabel(statusRaw) : 'ACTIVE';
  if (statusRaw && !['active', 'inactive'].includes(statusRaw.toLowerCase())) {
    return { kind: 'fail', reason: `Status "${statusRaw}" is not valid — use Active or Inactive` };
  }

  const candidate = {
    name,
    client_name: get('client_name'),
    email: get('email'),
    phone: get('phone'),
    website: get('website'),
    address: get('address'),
    city: get('city'),
    state: get('state'),
    country: get('country'),
    status,
    account_manager_id: accountManagerId,
  };

  // The SAME schema the Add Company form is validated against, so an email/website that the
  // form would reject fails the row with the same message.
  const parsed = companySchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      kind: 'fail',
      reason: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation failed',
    };
  }

  ctx.seenNames.add(nameKey);

  return {
    kind: 'ready',
    row: {
      company: {
        name,
        client_name: parsed.data.client_name ?? '',
        email: parsed.data.email ?? '',
        phone: parsed.data.phone ?? '',
        website: parsed.data.website ?? '',
        address: parsed.data.address ?? '',
        city: parsed.data.city ?? '',
        state: parsed.data.state ?? '',
        country: parsed.data.country ?? '',
        status: parsed.data.status ?? 'ACTIVE',
        account_manager_id: accountManagerId,
      },
      manager,
      rounds: parseCompanyRoundsCell(get('interview_rounds')),
    },
  };
}