/**
 * Role-based permissions for the Demand Fulfillment workflow (pipeline, interviews,
 * onboarding, super-admin config). Builds on demandPermissions.ts's ownership model
 * and demandVisibility.ts's row-visibility rules — this file adds the *action*-level
 * rules specific to this module (status changes, hold/cancel/reopen/close, config edits).
 *
 * Role summary (existing `profiles.role` values):
 * - account_manager : full control over demands where they are the CURRENT Account Manager
 *                     (`contact_profile_id`) — not just the creator; reassigning a demand's AM
 *                     moves this access with it (see isCurrentAccountManager below). Can
 *                     assign/reassign, change any status, reopen, override config.
 * - spoc            : single point of contact for demands assigned to them via
 *                     `spoc_profile_id`; can review/shortlist candidates and update
 *                     customer feedback, cannot manage other SPOCs' demands.
 * - ta              : "Recruiter" in the spec. Sees every demand (the list defaults to the
 *                     ones they're allocated to via demand_ta_allocations) and may upload
 *                     profiles to any of them; manages the pipeline only where allocated.
 * - super_admin     : configures global settings (interview defaults, doc/BGV
 *                     checklists, resume cap) and has AM-level override everywhere.
 */

interface FulfillmentActor {
  role?: string | null;
  id?: string | null;
}

interface DemandOwnershipFields {
  created_by?: string | null;
  contact_profile_id?: string | null;
  spoc_profile_id?: string | null;
}

/**
 * Is this actor the demand's CURRENT Account Manager? Deliberately `contact_profile_id` only,
 * never `created_by`: creating a demand does not entitle you to manage its pipeline forever —
 * once it's reassigned to a different AM (contact_profile_id changes), the original creator
 * loses pipeline-management access and the new AM gains it. (Editing the demand's own master
 * fields is a separate concern — see isDemandOwner in demandPermissions.ts, which is
 * deliberately NOT changed by this rule.)
 */
function isCurrentAccountManager(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  return !!actor.id && demand.contact_profile_id === actor.id;
}

/** Only AM (owner) or Super Admin may change demand-level status (incl. hold/cancel/reopen/close). */
export function canChangeDemandStatus(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') {
    return isCurrentAccountManager(actor, demand);
  }
  return false;
}

/** Only AM (owner) or Super Admin may assign/reassign a demand's team. */
export function canManageDemandAssignments(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  return canChangeDemandStatus(actor, demand);
}

/** Only AM (owner) or Super Admin may clone a demand — same ownership rule as any other
 *  demand-level write (status change, assignment). Named separately for audit clarity at
 *  call sites even though it's currently identical to canChangeDemandStatus. */
export function canCloneDemand(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  return canChangeDemandStatus(actor, demand);
}

/**
 * Who can add/manage candidates in a demand's pipeline, and who can schedule interviews for it.
 * `recruiterIds` is the demand's current demand_ta_allocations.ta_id list.
 *
 * The last-round change request lets an assigned SPOC upload profiles, accept or reject
 * shortlists, and update interview status. That conflicts with the older note in
 * docs/ROLES_AND_PERMISSIONS.md that SPOC is read-only on the pipeline. The change
 * request wins here: an assigned SPOC may manage the pipeline of demands where
 * `spoc_profile_id` is them. They still cannot edit the demand record itself.
 */
export function canManageDemandPipeline(
  actor: FulfillmentActor,
  demand: DemandOwnershipFields,
  recruiterIds: string[]
): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') return isCurrentAccountManager(actor, demand);
  if (actor.role === 'spoc') return !!actor.id && demand.spoc_profile_id === actor.id;
  if (actor.role === 'ta') return !!actor.id && recruiterIds.includes(actor.id);
  return false;
}

/**
 * Who can UPLOAD profiles to a demand (add a candidate to its pipeline as Sourced). Everyone who
 * can manage the pipeline, plus ANY Recruiter (ta), assigned or not: recruiters work across all
 * demands and may source for one they are not assigned to (client request, Nov 2026).
 *
 * Upload only. Moving the candidate on, scheduling interviews, onboarding etc. on an unassigned
 * demand stay with canManageDemandPipeline, so the assigned team keeps ownership of the pipeline.
 */
export function canUploadProfilesToDemand(
  actor: FulfillmentActor,
  demand: DemandOwnershipFields,
  recruiterIds: string[]
): boolean {
  if (canManageDemandPipeline(actor, demand, recruiterIds)) return true;
  return actor.role === 'ta' && !!actor.id;
}

/**
 * AM or the assigned SPOC may record interview status and a comment on the Selection tab.
 * Broader interview edit (reschedule, delete) stays on canEditInterview.
 */
export function canUpdateSelectionStatus(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') return isCurrentAccountManager(actor, demand);
  if (actor.role === 'spoc') return !!actor.id && demand.spoc_profile_id === actor.id;
  return false;
}

/** SPOC-specific: can only review/shortlist/comment on demands where they are the assigned SPOC. */
export function isSpocForDemand(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  return actor.role === 'spoc' && !!actor.id && demand.spoc_profile_id === actor.id;
}

/** Only Super Admin may edit the global demand-fulfillment settings. */
export function canManageSuperAdminSettings(role?: string | null): boolean {
  return role === 'super_admin';
}

/** Only Super Admin may create/rename/delete/reorder the Skills library (categories + skills). */
export function canManageSkillsLibrary(role?: string | null): boolean {
  return role === 'super_admin';
}

/** Interview config (per-demand round overrides): AM/SPOC on the demand, or Super Admin. */
export function canManageInterviewConfig(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') return isCurrentAccountManager(actor, demand);
  if (actor.role === 'spoc') return demand.spoc_profile_id === actor.id;
  return false;
}

/**
 * Log a call about a candidate on a demand (Call Log, Sourcing tab). Calls are sourcing work, so
 * the rule is the upload rule: anyone who may add profiles to the demand — including any
 * Recruiter — since a "Fit" call adds the candidate to the pipeline.
 */
export function canLogDemandCall(actor: FulfillmentActor, demand: DemandOwnershipFields, recruiterIds: string[]): boolean {
  return canUploadProfilesToDemand(actor, demand, recruiterIds);
}

/**
 * Write the demand's Instruction Log (customer instructions for the recruiters): Super Admin, the
 * demand's current AM, or its assigned SPOC. Everyone who can view the demand can read it.
 */
export function canWriteDemandInstructions(actor: FulfillmentActor, demand: DemandOwnershipFields): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'account_manager') return isCurrentAccountManager(actor, demand);
  if (actor.role === 'spoc') return !!actor.id && demand.spoc_profile_id === actor.id;
  return false;
}

/** Edit / delete one instruction: its author while they can still write, or Super Admin. */
export function canManageDemandInstruction(
  actor: FulfillmentActor,
  demand: DemandOwnershipFields,
  instruction: { created_by: string | null }
): boolean {
  if (actor.role === 'super_admin') return true;
  return canWriteDemandInstructions(actor, demand) && !!actor.id && instruction.created_by === actor.id;
}
