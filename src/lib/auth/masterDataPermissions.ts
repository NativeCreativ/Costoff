/**
 * Master Data Management writes follow the same gate as Clients Master and Demand
 * Fulfillment Settings: Super Admin. Account Managers are not locked out of the
 * demand-form pickers — those GETs stay open to any authenticated user, the same
 * way GET /api/skills-library is.
 *
 * Clients themselves keep `companyPermissions` (create/edit is super_admin; the
 * demand dropdown stays open to account_manager).
 */
export function canManageMasterData(role?: string | null): boolean {
  return role === 'super_admin';
}

export function canViewMasterData(role?: string | null): boolean {
  return canManageMasterData(role);
}
