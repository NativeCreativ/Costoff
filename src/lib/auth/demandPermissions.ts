/**
 * Role-based Demand permissions, shared by the API routes (enforcement) and the UI (show/hide).
 *
 * Ownership model:
 * - `created_by`          → the profile that created the Demand.
 * - `contact_profile_id`  → the Demand's Account Manager (AM-only; see migration
 *                           20260924170125_split_demand_spoc_assignment — this used to be
 *                           dual-purpose AM-or-SPOC, now split).
 * - `spoc_profile_id`     → the Demand's SPOC contact, independent of the AM.
 * - `demand_ta_allocations` → the TAs (recruiters) assigned to the Demand.
 *
 * An AM owns a Demand they created or that is assigned to them as its AM (`contact_profile_id`).
 */

/** Roles that can see every Demand. AM is deliberately NOT here: an Account Manager sees only
 *  the demands they are the AM of (see buildDemandVisibilityCondition / canViewDemand). */
export const DEMAND_VIEW_ALL_ROLES = ['super_admin', 'hr', 'viewer'];
/** Roles that can create Demands (and edit/delete per ownership rules below). */
export const DEMAND_WRITE_ROLES = ['super_admin', 'account_manager'];
/** Existing statuses that represent a Closed / Inactive Demand. Only these can be deleted. */
export const DEMAND_DELETABLE_STATUSES = ['Closure', 'Cancelled'];

export const DEMAND_DELETE_BLOCKED_MESSAGE = 'Only demands in Closure or Cancelled status can be deleted.';

interface DemandActor {
  role?: string | null;
  id?: string | null;
}

interface DemandOwnershipFields {
  created_by?: string | null;
  contact_profile_id?: string | null;
  status?: string | null;
}

export function canCreateDemand(role?: string | null): boolean {
  return !!role && DEMAND_WRITE_ROLES.includes(role);
}

export function isDemandOwner(demand: DemandOwnershipFields, userId?: string | null): boolean {
  if (!userId) return false;
  // Being the AM is the ownership test. `created_by` no longer grants it: an AM who created a
  // demand for someone else must not keep editing it after it is reassigned.
  return demand.contact_profile_id === userId;
}

export function canEditDemand(actor: DemandActor, demand: DemandOwnershipFields): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') return isDemandOwner(demand, actor.id);
  return false;
}

export function isDemandDeletableStatus(status?: string | null): boolean {
  return !!status && DEMAND_DELETABLE_STATUSES.includes(status);
}

/** Delete requires BOTH edit permission (role/ownership) AND a Closed/Inactive status. */
export function canDeleteDemand(actor: DemandActor, demand: DemandOwnershipFields): boolean {
  return canEditDemand(actor, demand) && isDemandDeletableStatus(demand.status);
}

/**
 * AMs may assign a Demand to themselves or to a SPOC, never to another AM.
 * Super Admin may assign to any AM/SPOC (validated separately against DEMAND_ASSIGNEE_ROLES).
 */
export function canAssignDemandTo(
  actor: DemandActor,
  assignee: { id: string; role: string }
): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') {
    return assignee.role === 'spoc' || assignee.id === actor.id;
  }
  return false;
}

interface DemandVisibilityFields {
  contact_profile_id?: string | null;
  spoc_profile_id?: string | null;
  recruiterIds?: string[];
  /** Draft (saved, not submitted): only its creator and Super Admin may see it. */
  is_draft?: boolean | null;
  created_by?: string | null;
}

/**
 * Row-level read visibility for a single demand's detail/sub-resource routes (lifecycle,
 * candidates, events, status-events, interview-config, assignments, etc.) — the same rule
 * the list endpoint applies via buildDemandVisibilityCondition, but for direct-by-id access.
 * Every demand-detail GET route must call this so an AM, SPOC or TA can't bypass list scoping
 * by guessing/copying a request_id or UUID. An AM sees only demands they are the AM of, so a
 * demand with no AM is invisible to them; roles in DEMAND_VIEW_ALL_ROLES see any demand.
 */
export function canViewDemand(actor: DemandActor, demand: DemandVisibilityFields): boolean {
  if (!actor.role) return false;
  if (demand.is_draft && actor.role !== 'super_admin') return !!actor.id && demand.created_by === actor.id;
  if (DEMAND_VIEW_ALL_ROLES.includes(actor.role)) return true;
  if (actor.role === 'account_manager') return !!actor.id && demand.contact_profile_id === actor.id;
  if (actor.role === 'spoc') return !!actor.id && demand.spoc_profile_id === actor.id;
  // A Recruiter may view any demand (and upload profiles to it — canUploadProfilesToDemand).
  // Their Demands list still opens on "My demands" (assignedToMe), which is UX, not a boundary.
  if (actor.role === 'ta') return !!actor.id;
  return false;
}
