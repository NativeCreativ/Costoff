import { Prisma } from '@/generated/prisma/client';
import { rawIdentifier } from '@/lib/auth/rawSqlIdentifier';
import type { SessionPayload } from '@/lib/auth/jwt';
import { DEMAND_VIEW_ALL_ROLES } from '@/lib/auth/demandPermissions';
export function buildDemandVisibilityCondition(user: SessionPayload, alias = 'v'): Prisma.Sql | null {
  if (DEMAND_VIEW_ALL_ROLES.includes(user.role)) return null;

  const a = rawIdentifier(alias);

  // Rule: an Account Manager sees only the demands they are the AM of. A demand with no AM
  // (AM is optional) is therefore invisible to AMs, but visible to every other role.
  if (user.role === 'account_manager') {
    return Prisma.sql`${a}.contact_profile_id = ${user.userId}::uuid`;
  }

  if (user.role === 'spoc') {
    return Prisma.sql`${a}.spoc_profile_id = ${user.userId}::uuid`;
  }

  // A Recruiter sees every demand (see canViewDemand). "Only mine" is the opt-in
  // buildAssignedToMeCondition, which the Demands list turns on by default for them.
  if (user.role === 'ta') return null;

  return Prisma.sql`FALSE`;
}

/**
 * "My demands": the demands this user is assigned to — AM (contact_profile_id), SPOC
 * (spoc_profile_id) or Recruiter (demand_ta_allocations). A filter the user chooses, never an
 * access rule; Super Admin and read-only roles are not assigned to demands, so it returns null
 * (no narrowing) for them.
 */
export function buildAssignedToMeCondition(user: SessionPayload, alias = 'v'): Prisma.Sql | null {
  const a = rawIdentifier(alias);
  if (user.role === 'account_manager') return Prisma.sql`${a}.contact_profile_id = ${user.userId}::uuid`;
  if (user.role === 'spoc') return Prisma.sql`${a}.spoc_profile_id = ${user.userId}::uuid`;
  if (user.role === 'ta') {
    return Prisma.sql`EXISTS (
      SELECT 1 FROM demand_ta_allocations dta
      WHERE dta.demand_id = ${a}.id AND dta.ta_id = ${user.userId}::uuid
    )`;
  }
  return null;
}

/**
 * "Demands this actor may upload profiles to" — the list-side twin of canUploadProfilesToDemand,
 * for pickers like "which Requirement is this new candidate for?". Same as
 * buildDemandManageableCondition except a Recruiter is not narrowed to their allocations.
 */
export function buildDemandUploadableCondition(user: SessionPayload, alias = 'v'): Prisma.Sql | null {
  if (user.role === 'ta') return null;
  return buildDemandManageableCondition(user, alias);
}

/**
 * Dashboard scope. Same as buildDemandVisibilityCondition, except a Recruiter's dashboard stays
 * on the demands they are assigned to: they may browse every demand, but their KPIs, funnel and
 * aging table describe their own work, exactly as before they could see the rest.
 */
export function buildDashboardDemandCondition(user: SessionPayload, alias = 'v'): Prisma.Sql | null {
  if (user.role === 'ta') return buildAssignedToMeCondition(user, alias);
  return buildDemandVisibilityCondition(user, alias);
}

/**
 * Narrower than buildDemandVisibilityCondition: "demands this actor can manage the pipeline
 * of" (add candidates, schedule interviews, etc.), not "demands this actor may merely view".
 *
 * account_manager is deliberately in DEMAND_VIEW_ALL_ROLES (sees every Demand — unchanged,
 * long-standing behavior), but that is read-only breadth: managing a Demand's pipeline
 * requires being its CURRENT Account Manager (contact_profile_id) — NOT merely having created
 * it, exactly what canManageDemandPipeline / isCurrentAccountManager
 * (src/lib/auth/demandFulfillmentPermissions.ts) enforce server-side. Creating a demand does
 * not entitle you to manage its pipeline forever; reassigning its AM moves this access with
 * it. A picker that lets an AM pick a demand (e.g. "which Requirement is this new candidate
 * for?") must use THIS condition, not buildDemandVisibilityCondition, or it will offer demands
 * the subsequent write then rejects with a 403 — or, before this fix, demands the actor merely
 * created but is no longer the AM for.
 *
 * super_admin can manage every demand, so this returns null (no filter) for them, same as
 * buildDemandVisibilityCondition's "view all" roles.
 */
export function buildDemandManageableCondition(user: SessionPayload, alias = 'v'): Prisma.Sql | null {
  if (user.role === 'super_admin') return null;

  const a = rawIdentifier(alias);

  if (user.role === 'account_manager') {
    return Prisma.sql`${a}.contact_profile_id = ${user.userId}::uuid`;
  }

  if (user.role === 'ta') {
    return Prisma.sql`EXISTS (
      SELECT 1 FROM demand_ta_allocations dta
      WHERE dta.demand_id = ${a}.id AND dta.ta_id = ${user.userId}::uuid
    )`;
  }

  return Prisma.sql`FALSE`;
}
