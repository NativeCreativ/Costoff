// Rule: an Account Manager owns their clients — the AM-scoped client dropdown is companies
// whose account_manager_id is them (a company managed by a Delivery Head has no AM and is
// therefore hidden from them), and Clients Master itself is super_admin only.

interface CompanyActor {
  role?: string | null;
  id?: string | null;
}

/** Roles allowed to open the Add Demand client dropdown (only they can reach Add Demand). */
export const COMPANY_DROPDOWN_ROLES = ['super_admin', 'account_manager'];

/** Clients Master (create/edit/delete/import/export/rounds) is super_admin only. */
export const COMPANY_WRITE_ROLES = ['super_admin'];

export function canViewCompanies(role?: string | null): boolean {
  return !!role && COMPANY_WRITE_ROLES.includes(role);
}

/** Clients Master is super_admin only — the one gate every master route uses. */
export function canManageCompanies(role?: string | null): boolean {
  return canViewCompanies(role);
}

export function canCreateCompany(role?: string | null): boolean {
  return canManageCompanies(role);
}

/** Create and Edit share one gate — like canCreateDemand/canEditDemand do for the same roles. */
export function canEditCompany(role?: string | null): boolean {
  return canManageCompanies(role);
}

export function canManageCompanyInterviewRounds(role?: string | null): boolean {
  return canManageCompanies(role);
}

/** Only super admin may quick-create a client from Add Demand ("+ Add Client"). */
export function canQuickCreateCompany(role?: string | null): boolean {
  return canManageCompanies(role);
}

/**
 * Whether this actor may use the given company. Same rule as buildCompanyScopeWhere, expressed
 * per row so the demand write path can re-check a company_id that was passed directly.
 */
export function canUseCompany(
  role: string | null | undefined,
  actorId: string | null | undefined,
  companyAccountManagerId: string | null | undefined
): boolean {
  if (!role || !actorId) return false;
  if (role === 'super_admin') return true;
  return !!companyAccountManagerId && companyAccountManagerId === actorId;
}

/**
 * List a client's SPOCs and add a new one from the demand form ("Select SPOC" / "Add SPOC").
 * Narrower than Clients Master: a Delivery Head for any client, an AM only for their own
 * clients (the same scope as the Add Demand client dropdown).
 */
export function canManageCompanySpocsFromDemand(
  role: string | null | undefined,
  actorId: string | null | undefined,
  companyAccountManagerId: string | null | undefined
): boolean {
  return canUseCompanyDropdown(role) && canUseCompany(role, actorId, companyAccountManagerId);
}

/** Anyone who may reach the Add Demand client dropdown. */
export function canUseCompanyDropdown(role?: string | null): boolean {
  return !!role && COMPANY_DROPDOWN_ROLES.includes(role);
}

/**
 * Row scope for the client dropdown: a super admin sees every client, an AM only their own.
 * Null means "no filter" (super_admin). Demand create/update use this server-side too, so a
 * tampered company_id cannot attach a demand to another AM's client.
 */
export function buildCompanyScopeWhere(actor: CompanyActor): { account_manager_id?: string } | null {
  if (!actor.role || !actor.id) return null;
  if (actor.role === 'super_admin') return null;
  return { account_manager_id: actor.id };
}