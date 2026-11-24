import { prisma } from '@/lib/db/prisma';
import { findByNormalizedName, isUniqueViolation } from '@/lib/masters/masterName';
import type { CompanyRoundsClient as PrismaCompaniesClient } from '@/lib/companies/companyInterviewRounds';

/**
 * Columns the Company list/search matches against (mirrors constants/search.ts convention).
 *
 * Covers exactly what the search box advertises: company name, client name, company email,
 * company phone and location (city / state / country, plus the address line).
 */
export const COMPANY_SEARCH_FIELDS = [
  'name',
  'client_name',
  'email',
  'phone',
  'website',
  'address',
  'city',
  'state',
  'country',
] as const;

export interface CompanyRef {
  id: string;
  name: string;
  client_name: string | null;
  email: string | null;
  status: string;
}

/** Everything a caller may supply when creating a Company master record. */
export interface CompanyCreateInput {
  name: string;
  client_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  other_details?: string | null;
  status?: string | null;
  max_submissions_per_position?: number | null;
  rate_conversion_formula?: any;
  /**
   * Resolved owner pair from `resolveCompanyManager` (AM id + managed_by id). Exactly one is
   * set. Callers must resolve it from the session, never straight from the payload.
   */
  manager?: { account_manager_id: string | null; managed_by: string | null };
  created_by?: string | null;
}

/** Rows ready for prisma: trimmed strings, blank optional fields stored as NULL. */
type CompanyCreateData = {
  name: string;
  client_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  other_details: string | null;
  status: string;
  max_submissions_per_position: number;
  rate_conversion_formula?: any;
  account_manager_id: string | null;
  managed_by: string | null;
  created_by: string | null;
  updated_by: string | null;
};

/**
 * THE canonical Company-creation mapping. Every path that creates a Company goes through here —
 * the Company Master's "Add New Company" form and the Demand form's inline "+ Add Company" —
 * so the two can never disagree about how a field maps onto the record.
 *
 * The important rule: **`client_name` is only ever what the caller actually supplied.**
 * A blank/absent client name is stored as NULL, NOT copied from the company name. Client Name is
 * a distinct business label (it is what Client & Source Analytics groups demands by), so
 * inventing one from the company name silently corrupted the master record. The display fallback
 * a reader might want ("show the company name when there is no client label") belongs at the
 * READ side — see resolveDemandCompany() in app/api/demands/route.ts and the `company.client_name
 * || company.name` fallbacks in the Company UI — never baked into stored data.
 */
export function toCompanyCreateData(input: CompanyCreateInput): CompanyCreateData {
  const trimmed = input.name.trim();
  const blankToNull = (v?: string | null) => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    name: trimmed,
    client_name: blankToNull(input.client_name),
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    website: blankToNull(input.website),
    address: blankToNull(input.address),
    city: blankToNull(input.city),
    state: blankToNull(input.state),
    country: blankToNull(input.country),
    other_details: blankToNull(input.other_details),
    status: input.status?.trim() || 'ACTIVE',
    max_submissions_per_position: input.max_submissions_per_position ?? 5,
    rate_conversion_formula: input.rate_conversion_formula ?? null,
    // The owner pair is resolved by resolveCompanyManager, so both columns are already validated.
    account_manager_id: input.manager?.account_manager_id ?? null,
    managed_by: input.manager?.managed_by ?? null,
    created_by: input.created_by ?? null,
    updated_by: input.created_by ?? null,
  };
}

/**
 * Look up an existing Company by normalized name, or report that the name is free.
 *
 * Split out from findOrCreateCompanyByName so a caller that must NOT silently reuse (the
 * Company module's create form) can surface an explicit "already exists" outcome, while the
 * Demand form's quick-create still gets create-or-reuse in one call.
 */
export async function lookupCompanyByName(name: string): Promise<CompanyRef | null> {
  return findByNormalizedName<CompanyRef>(prisma.companies)(name.trim());
}

/**
 * Create a Company master record in a single write.
 *
 * Single write (not create-then-update) so a partial field set can never be observed and so the
 * canonical mapping above is applied exactly once.
 *
 * Pass `client` to create inside an already-open transaction — the Add Company route uses that
 * to create the company AND its initial interview rounds atomically, so a company can never be
 * left existing with neither a name nor the rounds the user typed alongside it.
 */
export async function createCompanyMaster(input: CompanyCreateInput, client?: PrismaCompaniesClient) {
  return (client ?? prisma).companies.create({ data: toCompanyCreateData(input) });
}

/**
 * Create-or-reuse a Company by normalized name — the Demand form's inline "+ Add Company".
 *
 * Only a name is collected there, so only `name` is written; `client_name` stays NULL (see
 * toCompanyCreateData). An existing company with the same normalized name is reused rather than
 * duplicated, and `created: false` tells the UI to say so instead of silently pretending a new
 * company was made.
 *
 * Order of resolution:
 *   1. an existing row whose normalized name matches  -> reuse it (no write)
 *   2. otherwise create it, and on a unique-violation race return the winner
 */
export async function findOrCreateCompanyByName(
  name: string,
  extra: {
    client_name?: string | null;
    email?: string | null;
    created_by?: string | null;
    /** Resolved owner pair — these quick-create paths collect no AM, so it is always the actor. */
    manager?: { account_manager_id: string | null; managed_by: string | null };
  } = {}
): Promise<{ company: CompanyRef; created: boolean }> {
  const trimmed = name.trim();
  const existing = await findByNormalizedName<CompanyRef>(prisma.companies)(trimmed);
  if (existing) return { company: existing, created: false };

  try {
    const created = await prisma.companies.create({
      data: toCompanyCreateData({ name: trimmed, client_name: extra.client_name, email: extra.email, created_by: extra.created_by, manager: extra.manager }),
      select: { id: true, name: true, client_name: true, email: true, status: true },
    });
    return { company: created, created: true };
  } catch (dbError) {
    // Lost the race to a concurrent create of the same normalized name: the other writer's
    // row is canonical, so converge on it instead of failing the user's quick-create.
    if (isUniqueViolation(dbError)) {
      const winner = await findByNormalizedName<CompanyRef>(prisma.companies)(trimmed);
      if (winner) return { company: winner, created: false };
    }
    throw dbError;
  }
}
