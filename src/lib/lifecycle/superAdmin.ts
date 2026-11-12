/**
 * Super Admin access policy.
 *
 * Super Admin is unrestricted across Demands, Candidates and Interviews: no demand
 * ownership, no recruiter-assignment and no candidate-ownership restriction applies.
 *
 * The role gates themselves already exist and are reused rather than duplicated:
 *   - canEditDemand / canDeleteDemand / canViewDemand   (demandPermissions)
 *   - canManageDemandPipeline / canChangeDemandStatus   (demandFulfillmentPermissions)
 *   - canManageInterview                               (interviewPermissions)
 *   - canAccessCandidate / CANDIDATE_VIEW_ALL_ROLES     (candidatePermissions)
 * each returns true immediately for super_admin, so no extra branch is needed at the
 * call sites. This module exists only to centralise the intent and give the frontend a
 * single predicate, so a future role change has one place to edit.
 */

export const SUPER_ADMIN_ROLE = 'super_admin';

export function isSuperAdmin(role?: string | null): boolean {
  return role === SUPER_ADMIN_ROLE;
}

/**
 * May this role see and act on candidate/interview actions for any demand?
 *
 * True for super_admin. Deliberately narrow: this does NOT grant AM or recruiter access
 * to demands they do not own / are not allocated to — those roles stay scoped.
 */
export function hasUnrestrictedWorkflowAccess(role?: string | null): boolean {
  return isSuperAdmin(role);
}
