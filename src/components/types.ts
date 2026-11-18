/* ─────────────── TYPE DEFINITIONS ─────────────── */

export interface KPIState {
  openDemands: number;
  agingDemandsRedFlag: number;
  activeCandidates: number;
  interviewsToday: number;
  offersThisMonth: number;
  onboardingsThisMonth: number;
}

export interface AgingDemand {
  id: string;
  client: string;
  role: string;
  priority: string;
  daysOpen: number;
  assignedAM: string;
}

export interface Demand {
  id: string;
  request_id: string;
  /** The Company master this demand belongs to — the source of truth for company data. */
  company_id?: string | null;
  end_client_id?: string | null;
  end_client_name?: string | null;
  /** Demand Type master name (Technical / Non-Technical / Domain / General). */
  demand_type?: string | null;
  engagement_type?: string | null;
  client_demand_id?: string | null;
  intermediary_partner?: string | null;
  shift_timings?: string | null;
  comments?: string | null;
  other_details?: string | null;
  customer_jd?: string | null;
  /** Uploaded Customer JD file (url under /uploads/jd/) and its original name. */
  customer_jd_file_url?: string | null;
  customer_jd_file_name?: string | null;
  total_experience?: string | null;
  relevant_experience?: string | null;
  /** [{ name, type }] — read with toDemandCertifications(). */
  certifications?: unknown;
  client_spoc_ids?: string[];
  skill_group_name?: string | null;
  /** @deprecated Mirror of the selected company's client label (see lib/companies/companyMaster.ts). */
  client_name?: string;
  job_title?: string;
  skill_description: string;
  priority: string;
  status: string;
  days_open: number;
  is_red_flag: boolean;
  /** Joined for display from DEMANDS_WITH_AGING_BASE (LEFT JOIN companies), same denormalized-join
   *  convention as am_name/spoc_name. */
  company_city?: string | null;
  company_country?: string | null;
  /** The company master's website, resolved from company_id by the read query. */
  company_website?: string | null;
  /** The Demand's Account Manager (contact_profile_id) name. */
  am_name?: string;
  /** Deprecated: contact_profile_id is AM-only now, so this is always 'account_manager' when am_name is set. Kept for callers that still read it. */
  am_role?: string | null;
  /** The Demand's SPOC (spoc_profile_id) name, independent of the AM. */
  spoc_name?: string;
  role_category?: string;
  /** Skills-library category id (skill_categories.id) or null when none was ever picked.
   *  Not `role_category` — that one is the Employment Type enum. */
  skills_category_id?: string | null;
  technology_stack?: string[];
  /** Legacy single value (= work_modes[0]). Display with formatWorkModes(). */
  work_mode?: string;
  work_modes?: string[];
  company_name?: string;
  /** @deprecated Mirror of the selected company's email — see the `companies` master. */
  company_email?: string;
  compensation_currency_id?: string | null;
  compensation_type_id?: string | null;
  /** Free-text compensation bounds, stored and shown verbatim (e.g. "16LPA", "22 lakh", "6000").
   *  Never parsed as a number — render with formatCompensationRange(). */
  compensation_min?: string | null;
  compensation_max?: string | null;
  /** Joined for display (e.g. demand list/detail GET responses) — not sent on write. */
  compensation_currencies?: CompensationCurrency | null;
  compensation_types?: CompensationType | null;
  /** Flat equivalents of the above, from DEMANDS_WITH_AGING_BASE (src/lib/demands/demandAgingQuery.ts
   *  — the Demand list/lifecycle read path) — same denormalized-join convention as am_name/spoc_name above. */
  compensation_currency_code?: string | null;
  compensation_currency_symbol?: string | null;
  compensation_currency_name?: string | null;
  compensation_type_name?: string | null;
  /** Free-text chip list, entered the same way as `locations` — not tied to any master list. */
  experience_levels?: string[];
  locations?: string[];
  num_positions?: number;
  created_by?: string;
  updated_by?: string;
  /** The Demand's Account Manager (owner). */
  contact_profile_id?: string;
  /** The Demand's SPOC contact, independent of the AM. */
  spoc_profile_id?: string;
  recruiter_ids?: string[];
  recruiter_names?: string[];
  created_at?: string;
  updated_at?: string;
  is_public?: boolean;
  /** Clone Demand audit trail — set only on a demand created via Clone Demand (see POST
   *  /api/demands). cloned_from_demand_id points at the source demand, which Clone Demand
   *  never modifies — it is only ever cloned FROM once it's already Closure. */
  cloned_from_demand_id?: string | null;
  cloned_at?: string | null;
  cloned_by?: string | null;
  /** Joined for display from DEMANDS_WITH_AGING_BASE (same denormalized-join convention
   *  as am_name/spoc_name above): the source demand's Requirement ID, and the profile
   *  that performed the clone. Null on manually-created demands. */
  cloned_from_request_id?: string | null;
  cloned_by_name?: string | null;
}

/* ─────────────── COMPENSATION MASTERS ─────────────── */

export interface CompensationCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  sort_order: number;
  is_active: boolean;
  usage?: { demands: number };
  created_at?: string;
  updated_at?: string;
}

export interface CompensationType {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  usage?: { demands: number };
  created_at?: string;
  updated_at?: string;
}

/* ─────────────── SKILLS LIBRARY ─────────────── */

/** A skill within a skill_categories entry — admin-managed catalogue backing SkillsSelector.
 *  Picker source only: never a foreign key from demands/candidates, so deleting or renaming
 *  one never touches an already-saved demand or candidate. */
export interface Skill {
  id: string;
  category_id: string;
  name: string;
  /** `mandatory` or `optional`. */
  skill_type?: string;
  classification_id?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SkillCategory {
  id: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  skills: Skill[];
}

export interface ClientSpoc {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  /** Client (company) SPOCs only. */
  vertical?: string | null;
  supervisor?: string | null;
  supervisor_designation?: string | null;
  /** Client SPOCs only; missing = active. */
  is_active?: boolean;
}

export interface Candidate {
  id: string;
  full_name: string;
  phone: string;
  alternate_phone?: string;
  email: string;
  qualification?: string;
  specialization?: string;
  available_from?: string;
  skills?: string[];
  /** Skills-library category id (skill_categories.id) or null when none was ever picked. */
  skills_category_id?: string | null;
  current_company?: string;
  current_designation?: string;
  current_location?: string;
  preferred_locations?: string[];
  current_ctc?: number;
  expected_ctc?: number;
  /** Offer in hand from another company; see candidateUrgency. */
  offer_in_hand?: boolean;
  offer_company?: string | null;
  offer_ctc?: number | null;
  offer_doj?: string | null;
  /** Review batch 2 (Nov 2026). The PAN itself is never sent to the browser; pan_last4 is. */
  alternate_email?: string | null;
  relevant_experience?: string | null;
  pan_last4?: string | null;
  date_of_birth?: string | null;
  rtr_acknowledged?: boolean;
  rtr_note?: string | null;
  rtr_file_url?: string | null;
  rtr_file_name?: string | null;
  photo_url?: string | null;
  resume_url?: string | null;
  resume_file_name?: string | null;
  employee_id?: string | null;
  core_specialization?: string | null;
  duration_in_role?: string | null;
  reason_for_change?: string | null;
  last_working_day?: string | null;
  other_details?: string | null;
  total_experience?: string;
  work_mode?: string;
  linked_url?: string;
  source: string;
  availability?: string;
  added_by?: string;
  added_by_name?: string | null;
  added_by_email?: string | null;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  /**
   * Server-computed edit/archive permission for the current user. Demand assignment
   * grants view + create; creator ownership grants edit + delete — so this is false for
   * a candidate another recruiter (or an AM / Super Admin) added to a shared demand.
   * `undefined` means the endpoint did not report the flag (treat as allowed).
   */
  can_edit?: boolean;
  /** Populated when can_edit is false, so the UI can explain why the action is disabled. */
  edit_blocked_reason?: string | null;
  /** Only set by GET /api/candidates?requestId=... (the "Add Existing Candidate" picker):
   *  'inactive' means this candidate has a rejected/dropped/backed-out entry on THIS demand
   *  (previousStatus holds that status) — shown with a badge and re-added via reactivation,
   *  never a second pipeline row. A candidate with an ACTIVE entry on this demand is excluded
   *  from the results entirely, so entryState never needs an 'active' value. */
  entryState?: 'inactive' | 'none';
  previousStatus?: string | null;
}

export interface Interview {
  id: string;
  demand_id?: string | null;
  demand_request_id?: string;
  demand_job_title?: string | null;
  client_company_name?: string | null;
  client_name?: string | null;
  client_company_email?: string | null;
  am_name?: string | null;
  am_email?: string | null;
  candidate_id?: string | null;
  candidate_name?: string;
  candidate_email?: string | null;
  /** The configured round's real id (demand_interview_rounds.id) — the source of truth. */
  round_id?: string | null;
  /** Interview Round name: a denormalized display copy derived from round_id, never edited directly. */
  level: string;
  skill_tested: string;
  mode: string;
  scheduled_date: string;
  scheduled_time: string;
  end_time?: string | null;
  /** Auto-calculated from scheduled_time/end_time — never manually entered. */
  duration_minutes?: number | null;
  status: string;
  link_status?: string;
  meeting_link?: string;
  feedback?: string;
  result?: string | null;
  remark?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  profiles_interviews_created_byToprofiles?: { id: string; full_name: string; email: string } | null;
  /** Server-computed via canEditInterview against the interview's own Demand — never derived
   *  client-side from an unrelated, separately-paginated Demands list (that list may not even
   *  contain this interview's demand). Source of truth for the row's Edit/Delete affordances.
   *  Applies the CREATOR rule: false for an interview another recruiter scheduled. */
  can_manage?: boolean;
  /** Reason `can_manage` is false, for the disabled button's tooltip. */
  manage_blocked_reason?: string | null;
  /** Server-computed via canManageInterview (demand assignment only) — gates Schedule. */
  can_add?: boolean;
}

export interface Offer {
  id: string;
  offered_ctc?: number;
  offer_date: string;
  status: string;
  notes?: string;
  candidates?: { full_name: string; email: string; phone: string };
  demands?: { request_id: string; skill_description: string; client_name?: string };
}

/* ─────────────── NOTIFICATIONS ─────────────── */

/** A persisted in-app notification for the authenticated user. */
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  /** What the notification is about, e.g. 'demand'. Drives navigation. */
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

/** A feed item as returned by GET /api/notifications — notification plus resolved navigation. */
export interface NotificationFeedItem extends Notification {
  /** Null when the target is gone or no longer visible to this user; the UI then renders it
   *  as plain text with no link. */
  href?: string | null;
  target_request_id?: string | null;
}

export interface NotificationFeedPage {
  items: NotificationFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/* ─────────────── COMPANY MASTER ─────────────── */

/** A Company master record. No delete fields — the Company module is Create/View/Edit/Search only. */
export interface Company {
  id: string;
  /** Client label; falls back to `name` when not supplied (e.g. demand quick-create). */
  client_name?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  other_details?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status: string;
  /** Company-level SPOC. Null for a company that has never had one (the column is optional). */
  account_manager_id?: string | null;
  company_spocs?: ClientSpoc[];
  /** Denormalized account manager name/email from the join (AM only, else null). */
  account_manager_name?: string | null;
  account_manager_email?: string | null;
  /** Denormalized Delivery Head who manages the client when there is no AM. */
  managed_by_id?: string | null;
  managed_by_name?: string | null;
  managed_by_email?: string | null;
  /** Legacy empty row fallback = the logged-in Delivery Head's name (Edit Client only). */
  managed_by_fallback_name?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Present on list/detail responses (GET /api/companies) — denormalized creator name, same
   *  convention the Demand list uses for am_name / spoc_name. */
  created_by_name?: string | null;
  updated_by_name?: string | null;
  /** Linked-demand count, used by the list column and the "Demands in range" filter. */
  _count?: { demands: number };
  company_interview_rounds?: {
    round_id: string;
    round_order: number;
    mandatory: boolean;
    interview_rounds?: { id: string; name: string };
  }[];
}

/* ─────────────── DEMAND FULFILLMENT WORKFLOW ─────────────── */

export interface DemandAssignment {
  id: string;
  demand_id: string;
  user_id: string;
  role_in_demand: 'account_manager' | 'spoc' | 'recruiter';
  assigned_by?: string | null;
  assigned_at: string;
  is_active: boolean;
  remark?: string | null;
  profiles_demand_assignments_user_idToprofiles?: { id: string; full_name: string; email: string; role: string };
}

export interface DemandStatusEvent {
  id: string;
  demand_id: string;
  from_status?: string | null;
  to_status: string;
  remark?: string | null;
  created_by?: string | null;
  created_at: string;
  profiles?: { id: string; full_name: string; role?: string | null } | null;
}

/** One candidate attached to one demand — the pipeline pivot (existing `submissions` table, extended). */
export interface DemandCandidate {
  id: string;
  demand_id: string;
  candidate_id: string;
  added_by?: string | null;
  current_status: string;
  source: string;
  position_slot?: number | null;
  is_active: boolean;
  final_result?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  candidates?: Candidate;
  demands?: { request_id: string; skill_description: string; client_name?: string; company_name?: string };
  /**
   * Whether the logged-in user may change this candidate's status in THIS demand's pipeline.
   * Computed server-side by the same canEditAsRecordCreator rule the status route enforces
   * (demand assignment + creator ownership), so the Kanban board never offers a drag the API
   * would reject. Populated by GET /api/demands/[requestId]/candidates.
   */
  can_edit?: boolean;
  /** Why can_edit is false, for a tooltip on the non-draggable card. */
  edit_blocked_reason?: string | null;
}

export interface SubmissionEvent {
  id: string;
  submission_id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  content?: string | null;
  attachment_url?: string | null;
  created_by?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  /** Next follow-up date (YYYY-MM-DD) — set on call_log entries so a recruiter knows when to call again. */
  follow_up_at?: string | null;
  profiles?: { id: string; full_name: string; role?: string | null } | null;
}

export interface InterviewRound {
  name: string;
  /** Optional free-text interview mode for this round. NULL/blank = not recorded. */
  mode?: string | null;
  order: number;
  mandatory?: boolean;
  isActive?: boolean;
}

/** A materialized, ID-bearing interview round row (demand_interview_rounds) — what an
 *  interview's round_id actually references, as opposed to the editable JSON InterviewRound
 *  config above. */
export interface MaterializedInterviewRound {
  id: string;
  demand_id: string;
  name: string;
  /** Optional free-text interview mode for this round. NULL = not recorded. */
  mode?: string | null;
  round_order: number;
  mandatory: boolean;
  /** Back-link to the reusable interview_rounds master row for this name (nullable for a round
   *  configured before the master existed). */
  master_round_id?: string | null;
  /** Number of interviews already scheduled against this round on this demand — locks rename/delete
   *  in the editor when non-zero. Only populated by GET /api/demands/[requestId]/interview-config. */
  interviews_count?: number;
  /** True when this demand already has interviews against the round, so it can be neither deleted
   *  nor renamed (reorder and Mandatory remain available). Convenience flag over
   *  `interviews_count`; likewise populated only by the interview-config endpoint, and likewise
   *  just a UI hint — the save re-checks inside its transaction. */
  in_use?: boolean;
}

export interface DemandInterviewConfig {
  id: string;
  demand_id: string;
  rounds: InterviewRound[];
  updated_by?: string | null;
  updated_at: string;
}

export interface DemandInterview {
  id: string;
  submission_id: string;
  demand_id?: string | null;
  candidate_id?: string | null;
  /** The configured round's real id (demand_interview_rounds.id) — the source of truth. */
  round_id?: string | null;
  round_name?: string | null; // denormalized display copy, derived from round_id (stored in `level`)
  round_order?: number | null;
  scheduled_date: string;
  scheduled_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  mode?: string | null;
  meeting_link?: string | null;
  status?: string | null;
  feedback?: string | null;
  result?: string | null;
  remark?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  candidates?: { full_name: string; email: string; phone: string };
  demands?: { request_id: string; skill_description: string; client_name?: string };
  profiles_interviews_created_byToprofiles?: { id: string; full_name: string; email: string } | null;
  /** Denormalized fields added by the calendar feed (GET /api/calendar/interviews) for display convenience. */
  candidate_name?: string | null;
  demand_request_id?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  /**
   * Server-computed EDIT permission for this interview (creator ownership:
   * interviews.created_by) — false when another recruiter scheduled it, or when an
   * AM/Super Admin did. `undefined` means the endpoint did not report it (treat as allowed).
   */
  can_manage?: boolean;
  /** Populated when can_manage is false, for the disabled control's tooltip. */
  manage_blocked_reason?: string | null;
  /** Source of the candidate for this demand (e.g. Naukri, LinkedIn, Referral). From the
   *  pipeline entry (submission) that linked the candidate to the demand, with fallback
   *  to the candidate's own saved source. May be null if neither has a source. */
  source?: string | null;
}

export interface DocumentChecklistItem {
  name: string;
  required: boolean;
  received?: boolean;
  url?: string | null;
}

export interface DemandOnboarding {
  id: string;
  submission_id?: string | null;
  offer_id?: string | null;
  demand_id?: string | null;
  candidate_id?: string | null;
  documents_status: DocumentChecklistItem[];
  bgv_status: string;
  bgv_remark?: string | null;
  offer_released_at?: string | null;
  offer_accepted_at?: string | null;
  joined_at?: string | null;
  closure_due_at?: string | null;
  closure_feedback?: string | null;
  closed_at?: string | null;
  remark?: string | null;
  candidates?: { full_name: string; email: string; phone: string };
  demands?: { request_id: string; skill_description: string; client_name?: string };
}

export interface SuperAdminSettingsDF {
  resume_cap_per_position: number;
  /** Global suggestion source for the round configurator's "Or select an existing round" chips
   *  (Demand/Company forms) — read-only now; there is no admin UI left to edit this list. */
  interview_rounds_default: InterviewRound[];
  /** Active interview modes offered when scheduling an interview — read-only now; there is no
   *  admin UI left to edit this list. */
  interview_mode_options: { name: string; isActive: boolean }[];
  onboarding_document_checklist: { name: string; required: boolean; isActive: boolean }[];
  bgv_checklist: { name: string; required: boolean; isActive: boolean }[];
}

/** PUT /api/admin/settings/demand-fulfillment body — each Demand Fulfillment Settings tab saves
 *  itself per action and sends only the one field it owns (never the whole settings object).
 *  `interview_rounds_default` / `interview_mode_options` are deliberately excluded: both are
 *  read-only now, with no admin UI or write endpoint left to change them. */
export type SuperAdminSettingsPatch = Partial<
  Pick<SuperAdminSettingsDF, 'resume_cap_per_position' | 'onboarding_document_checklist' | 'bgv_checklist'>
>;

export interface Onboarding {
  id: string;
  bgv_status: string;
  actual_joining_date?: string;
  status: string;
  notes?: string;
  candidates?: { full_name: string; email: string; phone: string };
  demands?: { request_id: string; skill_description: string; client_name?: string };
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  phone?: string;
  date_of_joining?: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
}

export interface TAMetric {
  id: string;
  name: string;
  role: string;
  demandsWorked: number;
  candidatesScoped: number;
  submissions: number;
  /** No submission-target data exists in the DB — always null (never invented). */
  targetDaily: number | null;
  targetAchievedPct: number | null;
  interviewsScheduled: number;
  selections: number;
}

export interface AMMetric {
  id: string;
  name: string;
  /** Avg days demand-open → AM assignment; null when the AM has no such event. */
  intakeToAllocationDays: number | null;
  /** Avg days submission → sent-to-customer event; null when no such event. */
  submissionToClientDays: number | null;
  /** Accepted / total offers on the AM's demands; null when no offers. */
  offerAcceptanceRate: number | null;
  openDemandsManaged: number;
}

export interface ClientMetric {
  id: string;
  clientName: string;
  totalDemands: number;
  openDemands: number;
  submissions: number;
  interviews: number;
  offers: number;
  joins: number;
}

export interface GlobalKpiState {
  /** Avg days demand-open → closure; null when no demand has been closed. */
  avgTimeToFillDays?: number | null;
  /** Avg days submission → joined event; null when no submission has joined. */
  avgTimeToHireDays?: number | null;
  /** Accepted / total offers; null when no offers exist. */
  offerAcceptanceRatePct?: number | null;
  /** Completed / (completed + no-shows); null when no interview has an outcome. */
  interviewAttendanceRatePct?: number | null;
  onboardingConversionRatePct?: number | null;
}

export interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  details: string;
  user_name: string;
  created_at: string;
}

export interface ClientAccount {
  id: string;
  name: string;
  industry: string;
  location: string;
  notes: string;
}

export interface SlaConfig {
  redFlagDaysThreshold: number;
  intakeToAllocationSlaDays: number;
  submissionToClientSlaDays: number;
  autoArchiveDays: number;
}

/* ─────────────── STAGE & BGV COLOR DEFINITIONS ─────────────── */
export const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Sourced': { bg: '#f0f9ff', text: '#0369a1' },
  'Submitted for AM Review': { bg: '#fef3c7', text: '#92400e' },
  'Submitted to Client': { bg: '#eff6ff', text: '#1d4ed8' },
  'Shortlisted by Client': { bg: '#ecfdf5', text: '#065f46' },
  'L1 Interview': { bg: '#f0fdf4', text: '#15803d' },
  'L2 Interview': { bg: '#f0fdf4', text: '#15803d' },
  'Selected': { bg: '#ecfdf5', text: '#047857' },
  'Offer Released': { bg: '#eff6ff', text: '#1d4ed8' },
  'Joined': { bg: '#d1fae5', text: '#065f46' },
  'Rejected': { bg: '#fef2f2', text: '#991b1b' },
};

export const BGV_COLORS: Record<string, { bg: string; text: string }> = {
  'green': { bg: '#dcfce7', text: '#166534' },
  'amber': { bg: '#fef3c7', text: '#92400e' },
  'red': { bg: '#fee2e2', text: '#dc2626' },
  'in_progress': { bg: '#eff6ff', text: '#1d4ed8' },
};
