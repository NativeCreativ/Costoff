// Read-side shape of a company's owner, shared by the list and detail responses so both expose
// the same fields. account_manager_* is AM-only by contract, so a non-AM relation read off a
// legacy row is reported as null rather than surfacing a Delivery Head as the Account Manager.

type OwnerRow = {
  id: string;
  account_manager_id?: string | null;
  managed_by?: string | null;
  created_by_name?: string | null;
  profiles_companies_created_byToprofiles?: { full_name?: string } | null;
  profiles_companies_account_managerToprofiles?: { id?: string; full_name?: string; email?: string; role?: string } | null;
  profiles_companies_managed_byToprofiles?: { id?: string; full_name?: string; email?: string } | null;
};

export interface CompanyOwnerFields {
  account_manager_id: string | null;
  account_manager_name: string | null;
  account_manager_email: string | null;
  managed_by_id: string | null;
  managed_by_name: string | null;
  managed_by_email: string | null;
}

export function companyOwnerFields(row: OwnerRow): CompanyOwnerFields {
  const am = row.profiles_companies_account_managerToprofiles;
  const isAm = am?.role === 'account_manager';
  const managed = row.profiles_companies_managed_byToprofiles;

  return {
    account_manager_id: isAm ? (am?.id ?? row.account_manager_id ?? null) : null,
    account_manager_name: isAm ? (am?.full_name ?? null) : null,
    account_manager_email: isAm ? (am?.email ?? null) : null,
    managed_by_id: managed?.id ?? row.managed_by ?? null,
    managed_by_name: managed?.full_name ?? null,
    managed_by_email: managed?.email ?? null,
  };
}

/**
 * Display text for a company's owner: the AM's name, else "Managed by <Delivery Head>", else
 * "Unassigned" for a legacy row where neither is set. The ONLY place this wording lives, so the
 * form, the Clients Master table and the detail modal cannot drift.
 */
export function companyManagerDisplay(company: {
  account_manager_name?: string | null;
  managed_by_name?: string | null;
}): string {
  if (company.account_manager_name) return company.account_manager_name;
  if (company.managed_by_name) return `${company.managed_by_name}`;
  return 'Unassigned';
}

/** Drops the Prisma relation objects so only scalar columns remain on the response. */
export function omitRelations<T extends { [K: string]: unknown }>(row: T, keys: string[]): Omit<T, string> {
  const copy: Record<string, unknown> = { ...row };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, string>;
}