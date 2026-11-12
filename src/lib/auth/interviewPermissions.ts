/**
 * Role-based permissions for Interviews & Schedules. Builds on the existing Demand
 * ownership/visibility model (demandPermissions.ts, demandVisibility.ts) and the
 * existing demand-pipeline action rule (demandFulfillmentPermissions.ts) rather than
 * introducing a new ownership concept — an Interview's visibility/CRUD is entirely
 * derived from the user's relationship to the Interview's Demand, plus (for edit and
 * delete only) who created it.
 *
 * Role matrix (existing `profiles.role` values):
 * - super_admin     : full access to every Interview.
 * - account_manager : full access, scoped to Demands they own (created_by / contact_profile_id).
 * - spoc            : READ-ONLY, scoped to Demands where they are the assigned SPOC.
 * - ta              : view + create scoped to Demands they're allocated to
 *                     (demand_ta_allocations); edit + delete additionally require that
 *                     they created the interview — see canEditInterview.
 * - hr              : READ-ONLY, sees every Interview.
 * - viewer          : READ-ONLY, sees every Interview.
 *
 * This intentionally diverges from canManageDemandPipeline's general pipeline rule for
 * one case: SPOC can manage candidates in the pipeline generally, but Interviews are
 * explicitly read-only for SPOC per the RBAC spec — so mutation checks here gate on
 * role first (INTERVIEW_WRITE_ROLES), then delegate scope-matching to canManageDemandPipeline.
 */

import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { DEMAND_VIEW_ALL_ROLES, isDemandOwner } from '@/lib/auth/demandPermissions';
import { canEditAsRecordCreator, creatorEditBlockMessage } from '@/lib/auth/creatorScope';
import { INTERVIEW_COMPLETED_STATUS } from '@/constants/options';
import {
  INTERVIEW_READ_ALL_ROLES,
  INTERVIEW_WRITE_ROLES,
  INTERVIEW_DIRECT_CREATE_ROLES,
  canScheduleInterviewFromModule,
} from '@/lib/auth/recordPermissions';

/**
 * Role constants live in ./recordPermissions (prisma-free) and are re-exported here for the
 * existing server call sites, so the client and the API share one definition.
 */
export { INTERVIEW_READ_ALL_ROLES, INTERVIEW_WRITE_ROLES, INTERVIEW_DIRECT_CREATE_ROLES };
export { canScheduleInterviewFromModule as canCreateInterviewFromModule };

interface InterviewActor {
  role?: string | null;
  id?: string | null;
}

interface DemandOwnershipFields {
  created_by?: string | null;
  contact_profile_id?: string | null;
  spoc_profile_id?: string | null;
}

import type { Prisma } from '@/generated/prisma/client';

// Rule: Single interview read-check matching buildInterviewReadScope.
export function canViewInterview(
  actor: InterviewActor,
  interviewOrDemand: {
    created_by?: string | null;
    demands?: DemandOwnershipFields | null;
    demand?: DemandOwnershipFields | null;
    contact_profile_id?: string | null;
    spoc_profile_id?: string | null;
  }
): boolean {
  if (!actor.role || !actor.id) return false;
  if (INTERVIEW_READ_ALL_ROLES.includes(actor.role)) return true;
  if (actor.role === 'ta') return interviewOrDemand.created_by === actor.id;
  const demand = interviewOrDemand.demands ?? interviewOrDemand.demand ?? interviewOrDemand;
  if (actor.role === 'account_manager') return demand?.contact_profile_id === actor.id;
  if (actor.role === 'spoc') return demand?.spoc_profile_id === actor.id;
  return false;
}

// Rule: Central read visibility helper across list, calendar, detail, options and export.
export function buildInterviewReadScope(actor: InterviewActor): Prisma.interviewsWhereInput {
  if (!actor.role || !actor.id) return { id: '__no_access__' };
  if (INTERVIEW_READ_ALL_ROLES.includes(actor.role)) return {};
  if (actor.role === 'ta') return { created_by: actor.id };
  if (actor.role === 'account_manager') return { demands: { contact_profile_id: actor.id } };
  if (actor.role === 'spoc') return { demands: { spoc_profile_id: actor.id } };
  return { id: '__no_access__' };
}

/**
 * Can this actor manage (create, or the demand-pipeline level of manage) the Interview
 * belonging to `demand`? `recruiterIds` is the demand's current demand_ta_allocations
 * list.
 *
 * This is the VIEW + CREATE level. Edits and deletes are additionally gated on creator
 * ownership by canEditInterview — see the note there.
 */
export function canManageInterview(
  actor: InterviewActor,
  demand: DemandOwnershipFields,
  recruiterIds: string[]
): boolean {
  if (!actor.role || !INTERVIEW_WRITE_ROLES.includes(actor.role)) return false;
  return canManageDemandPipeline(actor, demand, recruiterIds);
}

/**
 * EDIT / RESCHEDULE / CANCEL / DELETE access to an Interview.
 *
 * Same split as candidates: demand assignment grants view + create, creator ownership
 * grants edit + delete. Two recruiters allocated to the same demand can both see the
 * interview and both schedule new ones, but only the recruiter who scheduled it may edit,
 * reschedule, cancel or archive it. When an Account Manager or Super Admin scheduled it
 * there is no recruiter creator, so the assigned recruiters get view + create only.
 *
 * `createdByIsRecruiter` is resolved from the database by the caller (recruiterProfileIds)
 * — the decision itself lives in canEditAsRecordCreator, shared with the candidate and
 * pipeline paths so the three can never drift.
 */
export function canEditInterview(
  actor: InterviewActor,
  demand: DemandOwnershipFields,
  recruiterIds: string[],
  createdBy?: string | null,
  createdByIsRecruiter: boolean = false
): boolean {
  if (!actor.role || !INTERVIEW_WRITE_ROLES.includes(actor.role)) return false;
  if (!canManageDemandPipeline(actor, demand, recruiterIds)) return false;
  if (actor.role !== 'ta') return true;
  if (!actor.id) return false;
  return canEditAsRecordCreator({
    actorId: actor.id,
    creatorId: createdBy,
    creatorIsRecruiter: createdByIsRecruiter,
    currentRecruiterIds: recruiterIds,
  });
}

/** A human-readable reason why interview edit was denied, for the 403 body and tooltips. */
export function interviewEditBlockReason(
  actor: InterviewActor,
  recruiterIds: string[],
  createdBy?: string | null,
  createdByIsRecruiter: boolean = false
): string | null {
  if (!actor.id) return 'You do not have permission to manage this interview.';
  if (createdBy === undefined) return null; // no creator supplied -> cannot explain
  if (actor.role !== 'ta') return 'You do not have permission to manage this interview.';
  return creatorEditBlockMessage({
    actorId: actor.id,
    creatorId: createdBy,
    creatorIsRecruiter: createdByIsRecruiter,
    currentRecruiterIds: recruiterIds,
  }, 'interview');
}

/* ─────────────── STATUS-BASED ROW ACTIONS ─────────────── */

/** The three stored result values, as normalized (trimmed, lowercased) keys. Still used
 *  for DISPLAY (badges, labels) — see normalizeInterviewResult — but no longer decides
 *  Edit/Delete eligibility; see statusActionRule below. */
export type InterviewResultKey = 'pass' | 'fail' | 'on_hold';

/**
 * Normalize an interview's stored `result` for comparison/display. The column is free text
 * and has been written as 'pass', 'on_hold' and 'on hold' over time (and by imports), so
 * every comparison goes through here rather than comparing raw strings.
 * Returns null for empty/pending/unknown values.
 */
export function normalizeInterviewResult(result: string | null | undefined): InterviewResultKey | null {
  const v = String(result ?? '').trim().toLowerCase();
  if (v === 'pass') return 'pass';
  if (v === 'fail') return 'fail';
  // Accept both the DB value 'on_hold' and the display form 'on hold'.
  if (v === 'on_hold' || v === 'on hold') return 'on_hold';
  return null;
}

/**
 * Which of Edit / Delete an interview's STATUS blocks. Every ROUND (interview row) is
 * evaluated independently, using only ITS OWN status — never another round's, never the
 * candidate's overall progress.
 *
 * - Completed                        : the record is locked — Edit AND Delete both blocked,
 *                                       regardless of result (Pass / Fail / On Hold). A
 *                                       completed interview is a finished, auditable record;
 *                                       correcting one goes through a controlled admin
 *                                       process rather than an in-place edit.
 * - Scheduled / Client No-Show /
 *   Candidate No-Show                : fully editable and deletable, regardless of result —
 *                                       these are not yet a finished outcome (Scheduled) or
 *                                       never produced one (a No-Show has no result), so
 *                                       correcting details or rescheduling must stay open.
 *
 * `result` plays NO part in this decision any more (it did previously — see git history —
 * but the business rule is now purely status-based).
 */
function statusActionRule(status: string | null | undefined): { canEdit: boolean; canDelete: boolean; reason: string | null } {
  if (status === INTERVIEW_COMPLETED_STATUS) {
    return {
      canEdit: false,
      canDelete: false,
      reason: 'A completed interview cannot be edited or deleted. Use the admin correction process if this was recorded in error.',
    };
  }
  return { canEdit: true, canDelete: true, reason: null };
}

export interface InterviewRowActionAccess {
  /** The signed-in user's role — the existing RBAC half of the decision. */
  role?: string | null;
  /**
   * The server-computed management flag for THIS interview (GET /api/interviews sets it
   * via canEditInterview, which already folds in demand scope + creator ownership).
   * Preferred over re-deriving from `role` alone, because ownership — not role — is what
   * actually decides edit/delete for recruiters.
   */
  canManage?: boolean;
  /** Server-supplied reason shown when canManage is false (e.g. scheduled by someone else). */
  blockedReason?: string | null;
}

export interface InterviewRowActions {
  canView: true;
  canEdit: boolean;
  canDelete: boolean;
  /** Why Edit is unavailable, or null when it is. */
  editBlockedReason: string | null;
  /** Why Delete is unavailable, or null when it is. */
  deleteBlockedReason: string | null;
}

/**
 * THE single decision for an interview row's View/Edit/Delete actions.
 *
 * An action is offered only when BOTH hold: the existing role/ownership check permits it
 * AND the interview's own STATUS does not block it (statusActionRule) — evaluated per round,
 * never from a candidate's other interview rounds and never from `result`.
 *
 * Used by the table rows AND by both bulk flows, so a row can never be actionable in the
 * bulk path while being hidden in the row path (or vice versa).
 */
export function getInterviewRowActions(
  interview: { status?: string | null },
  access: InterviewRowActionAccess = {}
): InterviewRowActions {
  const rule = statusActionRule(interview?.status);

  // Role gate. When the server already computed can_manage for this row, trust it (it
  // includes creator ownership); otherwise fall back to the plain write-role check.
  const roleAllowsManage =
    access.canManage !== undefined
      ? access.canManage
      : !!access.role && INTERVIEW_WRITE_ROLES.includes(access.role);
  const roleReason = access.blockedReason || 'You do not have permission to manage this interview';

  return {
    canView: true,
    canEdit: roleAllowsManage && rule.canEdit,
    canDelete: roleAllowsManage && rule.canDelete,
    editBlockedReason: !roleAllowsManage ? roleReason : rule.canEdit ? null : rule.reason,
    deleteBlockedReason: !roleAllowsManage ? roleReason : rule.canDelete ? null : rule.reason,
  };
}
