/**
 * Clone Demand — the shared client-side mapping from an existing Demand to the
 * pre-filled Create Demand form.
 *
 * Business rule: **any Demand can be cloned, in any status.** Once a demand exists and the
 * user is allowed to see it, its configuration is reusable as the starting point for another
 * requirement — the same company routinely needs several similar demands, so gating Clone on
 * Closure/Cancelled made the action undiscoverable on almost every row and blocked legitimate
 * reuse. The Clone action is therefore offered, and accepted, for Assign / Sourcing / Shortlist /
 * Selection / Onboarding / Closure / Cancelled alike.
 *
 * There is no DB or API change needed for this: the clone was always written as a brand-new
 * `demands` row, so relaxing the gate needed no schema work.
 *
 * What IS still enforced (all server-side, in POST /api/demands):
 *   • RBAC — `canCloneDemand`, the same ownership rule as any other demand write. A user who
 *     cannot create/modify a demand cannot clone one either.
 *   • The Company rule — a clone is a NEW demand, so it must reference an ACTIVE company exactly
 *     like a manually created demand (resolveDemandCompany, mode 'create'). A source whose
 *     company has since gone INACTIVE must be re-pointed at an active company in the pre-filled
 *     form. The source demand is never modified.
 *   • A clone never reuses the source's Request ID, status or any pipeline/runtime data.
 *
 * The mapping below drives the UI pre-fill only; the frontend can always be bypassed.
 *
 * What IS carried over: demand-level configuration only — client/company, job
 * title, description, skills, experience level, employment type, work mode,
 * locations, currency + compensation type, min/max compensation, positions, and
 * the AM / SPOC / Recruiter configuration. It all stays fully editable in the
 * form before saving, which is how the customer-side reassignment happens.
 *
 * What is deliberately NOT carried over:
 *   - `request_id`  → blank, so the backend generates a brand new Requirement ID.
 *                     Never inherit the source's ID.
 *   - `status`      → reset to `Assign`, the first state of the lifecycle, so the
 *                     clone starts a fresh lifecycle/approval flow.
 *   - created_by / created_at / updated_by / opened_at / closed_at  → never on a
 *                     Create Demand form at all; the server stamps them.
 *   - Candidate submissions, pipeline events, interviews, offers, onboarding/BGV,
 *                     status history, SLA/aging — none of these are part of
 *                     DemandFormState, so there is nothing to strip: a clone is a
 *                     brand-new `demands` row plus its recruiter allocations, and
 *                     every downstream table is keyed by demand_id.
 */

import type { Demand } from '@/components/types';
import type { DemandFormState } from '@/components/demands/DemandFormModal';
import { toDemandCertifications, toFormWorkModes } from '@/components/demands/demand.schema';

/**
 * Documents the eligibility rule at the call sites that used to branch on it.
 *
 * Kept as an exported constant purely so the "cloneable in every status" decision is stated in
 * exactly one place and any future re-introduction of a status gate is a deliberate, visible
 * change rather than an accidental one.
 */
export const DEMAND_CLONE_ELIGIBILITY_NOTE =
  'A Demand can be cloned in any status; only ownership and an ACTIVE company are required.';

/**
 * Whether to offer the Clone action on a row.
 *
 * Visibility is governed purely by the existing Demand write permission (`canEdit`) — never by
 * status — so the action appears on every demand the user may edit.
 */
export function canCloneDemandAction(demand: Pick<Demand, 'status'>, canEdit: boolean) {
  return { canShow: canEdit, canClone: canEdit, blockedReason: null };
}

/** Pre-fills the Create Demand form from `demand`. Every field remains editable. */
export function buildDemandCloneForm(demand: Demand): DemandFormState {
  return {
    request_id: '', // new Requirement ID is generated on save
    // The clone reuses the SAME Company master record (never a copy of it) — cloning a demand
    // must not create a second company. If that company is INACTIVE the form's ACTIVE-only
    // dropdown will not offer it, and the API rejects it: the user must pick/reactivate an
    // active company before saving. This is the same rule a manually created demand obeys.
    company_id: demand.company_id || '',
    end_client_id: demand.end_client_id || '',
    demand_type: demand.demand_type || '',
    job_title: demand.job_title || '',
    skill_description: demand.skill_description || '',
    role_category: (demand.role_category || 'Full Time') as DemandFormState['role_category'],
    priority: (demand.priority || 'High') as DemandFormState['priority'],
    status: 'Open', // a clone starts Open, the same as a new demand
    engagement_type: demand.engagement_type || '',
    client_demand_id: demand.client_demand_id || '',
    intermediary_partner: demand.intermediary_partner || '',
    shift_timings: demand.shift_timings || '',
    comments: demand.comments || '',
    customer_jd: demand.customer_jd || '',
    // The clone shares the source's JD file (files are never deleted, so this stays valid).
    customer_jd_file_url: demand.customer_jd_file_url || '',
    customer_jd_file_name: demand.customer_jd_file_name || '',
    client_spoc_ids: Array.isArray(demand.client_spoc_ids) ? [...demand.client_spoc_ids] : [],
    total_experience: demand.total_experience || '',
    relevant_experience: demand.relevant_experience || '',
    certifications: toDemandCertifications(demand.certifications),
    experience_levels: Array.isArray(demand.experience_levels) ? [...demand.experience_levels] : [],
    required_skills: Array.isArray(demand.technology_stack) ? [...demand.technology_stack] : [],
    skills_category_id: '', // the clone picks its own role category, like its own Requirement ID
    work_modes: toFormWorkModes(demand),
    compensation_currency_id: demand.compensation_currency_id || '',
    compensation_type_id: demand.compensation_type_id || '',
    // Free text, copied verbatim so the clone pre-fills with exactly what was stored.
    compensation_min: demand.compensation_min != null ? String(demand.compensation_min) : '',
    compensation_max: demand.compensation_max != null ? String(demand.compensation_max) : '',
    locations: Array.isArray(demand.locations) ? [...demand.locations] : [],
    num_positions: demand.num_positions || 1,
    contact_profile_id: demand.contact_profile_id || '',
    spoc_profile_id: demand.spoc_profile_id || '',
    recruiter_ids: Array.isArray(demand.recruiter_ids) ? [...demand.recruiter_ids] : [],
  };
}