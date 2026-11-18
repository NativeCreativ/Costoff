import { api } from '@/lib/axios';
import type {
  DemandAssignment,
  DemandStatusEvent,
  DemandCandidate,
  SubmissionEvent,
  DemandInterviewConfig,
  DemandInterview,
  DemandOnboarding,
  SuperAdminSettingsDF,
  SuperAdminSettingsPatch,
  MaterializedInterviewRound,
  Candidate,
} from '@/components/types';

/* ─────────────── Assignments ─────────────── */
export interface AssignDemandPayload {
  assignments: { user_id: string; role_in_demand: 'account_manager' | 'spoc' | 'recruiter' }[];
  clear_roles?: ('account_manager' | 'spoc' | 'recruiter')[];
  client_spoc_ids?: string[];
  remark?: string;
}

export async function assignDemand(requestId: string, payload: AssignDemandPayload): Promise<void> {
  await api.post(`/demands/${encodeURIComponent(requestId)}/assign`, payload);
}

export async function getDemandAssignments(requestId: string): Promise<DemandAssignment[]> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/assignments`);
  return data.assignments || [];
}

export async function getDemandStatusEvents(requestId: string): Promise<DemandStatusEvent[]> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/status-events`);
  return data.events || [];
}

/* ─────────────── Demand status ─────────────── */
export async function changeDemandStatus(requestId: string, to_status: string, remark?: string): Promise<void> {
  await api.patch(`/demands/${encodeURIComponent(requestId)}/status`, { to_status, remark });
}

export async function updateSubmissionSourcingType(requestId: string, dcId: string, sourcingType: 'active' | 'backup'): Promise<void> {
  await api.patch(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}`, { sourcing_type: sourcingType });
}

export async function closeDemand(requestId: string, closure_feedback: string, remark?: string): Promise<void> {
  await api.post(`/demands/${encodeURIComponent(requestId)}/close`, { closure_feedback, remark });
}

export interface BulkStatusResultItem {
  demand_id: string;
  request_id?: string;
  success: boolean;
  error?: string;
}

export interface BulkStatusResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: BulkStatusResultItem[];
}

/** Remark is mandatory for bulk changes (enforced server-side). */
export async function bulkChangeDemandStatus(demandIds: string[], to_status: string, remark: string): Promise<BulkStatusResult> {
  const { data } = await api.patch('/demands/bulk-status', { demand_ids: demandIds, to_status, remark });
  return data;
}

export interface BulkDeleteResultItem {
  demand_id: string;
  request_id?: string;
  success: boolean;
  error?: string;
}

export interface BulkDeleteResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: BulkDeleteResultItem[];
}

export async function bulkDeleteDemands(demandIds: string[]): Promise<BulkDeleteResult> {
  const { data } = await api.delete('/demands/bulk-delete', { data: { demand_ids: demandIds } });
  return data;
}

/* ─────────────── Candidate pipeline ─────────────── */
export interface DemandCandidatesFilters {
  status?: string;
  source?: string;
  recruiter_id?: string;
  position_slot?: number;
  /** Opt-in: restrict to candidates whose skills overlap the demand's technology_stack. */
  matchSkills?: boolean;
}

export interface DemandCandidatesResult {
  candidates: DemandCandidate[];
  cap: { cap: number; current: number; reached: boolean };
}

export async function getDemandCandidates(requestId: string, filters: DemandCandidatesFilters = {}): Promise<DemandCandidatesResult> {
  const params: Record<string, string | number> = {};
  if (filters.status) params.status = filters.status;
  if (filters.source) params.source = filters.source;
  if (filters.recruiter_id) params.recruiter_id = filters.recruiter_id;
  if (filters.position_slot) params.position_slot = filters.position_slot;
  if (filters.matchSkills) params.matchSkills = 'true';
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/candidates`, { params });
  return { candidates: data.candidates || [], cap: data.cap || { cap: 0, current: 0, reached: false } };
}

export interface AddDemandCandidatePayload {
  candidate_id?: string;
  new_candidate_data?: { full_name: string; email?: string; phone?: string; skills?: string[] };
  source?: string;
  position_slot?: number;
  remark?: string;
}

export async function addDemandCandidate(requestId: string, payload: AddDemandCandidatePayload): Promise<{ submission: DemandCandidate; otherDemands: any[] }> {
  const { data } = await api.post(`/demands/${encodeURIComponent(requestId)}/candidates`, payload);
  return { submission: data.submission, otherDemands: data.otherDemands || [] };
}

export interface DemandCandidateDetail {
  submission: DemandCandidate;
  events: SubmissionEvent[];
  interviews: DemandInterview[];
  otherDemands: any[];
}

export async function getDemandCandidateDetail(requestId: string, dcId: string): Promise<DemandCandidateDetail> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}`);
  return data;
}

export async function changeSubmissionStatus(requestId: string, dcId: string, to_status: string, remark?: string): Promise<void> {
  await api.patch(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}/status`, { to_status, remark });
}

export interface AddSubmissionEventPayload {
  event_type: string;
  content?: string;
  attachment_url?: string;
  metadata?: Record<string, unknown>;
  follow_up_at?: string;
}

export async function addSubmissionEvent(requestId: string, dcId: string, payload: AddSubmissionEventPayload): Promise<void> {
  await api.post(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}/events`, payload);
}

/* ─────────────── Interview config ─────────────── */
export interface InterviewConfigResult {
  /** Materialized, ID-bearing rounds (demand_interview_rounds) — what interviews.round_id
   *  actually references. Always non-empty once resolved (falls back through global/hardcoded
   *  defaults, materializing them for this demand on first read). */
  rounds: MaterializedInterviewRound[];
  hasOverride: boolean;
  updated_at: string | null;
}

export async function getInterviewConfig(requestId: string): Promise<InterviewConfigResult> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/interview-config`);
  return data;
}

/** One of THIS demand's own saved interview rounds — never a company/global fallback. */
export interface DemandOwnInterviewRound {
  id: string;
  name: string;
  mode: string | null;
  round_order: number;
  mandatory: boolean;
}

export interface DemandOwnInterviewRoundsResult {
  rounds: DemandOwnInterviewRound[];
  /** The demand's required skills (technology_stack), for skill-matching the Candidate field. */
  requiredSkills: string[];
}

/** Backs the global Interviews & Schedules screen's Round+Mode field and its Candidate
 *  skill-matching — deliberately a different read than getInterviewConfig (see the route). */
export async function getDemandOwnInterviewRounds(requestId: string): Promise<DemandOwnInterviewRoundsResult> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/own-interview-rounds`);
  return { rounds: data.rounds || [], requiredSkills: data.requiredSkills || [] };
}

/* ─────────────── Interviews (scheduling / updates) ─────────────── */
export interface ScheduleInterviewPayload {
  /** The configured round's real id. Omit to use or create the demand's default round. */
  round_id?: string;
  scheduled_date: string;
  scheduled_time?: string;
  end_time?: string;
  duration_minutes?: number;
  mode?: string;
  interview_type?: 'Technical' | 'Functional' | 'Managerial';
  interview_location?: 'Teams' | 'Direct_Call';
  meeting_link?: string;
  remark?: string;
}

export async function scheduleInterview(requestId: string, dcId: string, payload: ScheduleInterviewPayload): Promise<DemandInterview> {
  const { data } = await api.post(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}/interviews`, payload);
  return data.interview;
}

export interface UpdateInterviewPayload {
  status?: string;
  mode?: string;
  interview_type?: 'Technical' | 'Functional' | 'Managerial';
  interview_location?: 'Teams' | 'Direct_Call';
  feedback?: string;
  result?: string;
  /** The configured round's real id (demand_interview_rounds.id) — must belong to the interview's demand. */
  round_id?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  end_time?: string;
  meeting_link?: string;
  remark?: string;
}

export async function updateInterview(interviewId: string, payload: UpdateInterviewPayload): Promise<DemandInterview> {
  const { data } = await api.patch(`/interviews/${encodeURIComponent(interviewId)}`, payload);
  return data.interview;
}

export interface CalendarInterviewFilters {
  from?: string;
  to?: string;
  demand_id?: string;
  status?: string;
  round?: string;
}

export async function getCalendarInterviews(filters: CalendarInterviewFilters = {}): Promise<DemandInterview[]> {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.demand_id) params.demand_id = filters.demand_id;
  if (filters.status) params.status = filters.status;
  if (filters.round) params.round = filters.round;
  const { data } = await api.get('/calendar/interviews', { params });
  return data.interviews || [];
}

/* ─────────────── Onboarding ─────────────── */
export interface DemandOnboardingResult {
  onboarding: DemandOnboarding | null;
  suggestedDocumentsStatus?: { name: string; required: boolean; received: boolean }[];
}

export async function getDemandCandidateOnboarding(requestId: string, dcId: string): Promise<DemandOnboardingResult> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}/onboarding`);
  return data;
}

export interface UpdateOnboardingPayload {
  documents_status?: { name: string; required: boolean; received?: boolean; url?: string | null }[];
  bgv_status?: string;
  bgv_remark?: string;
  offer_released_at?: string;
  offer_accepted_at?: string;
  joined_at?: string;
  remark?: string;
}

export async function updateOnboarding(onboardingId: string, payload: UpdateOnboardingPayload): Promise<{ onboarding: DemandOnboarding; warning: string | null }> {
  const { data } = await api.patch(`/onboarding/${encodeURIComponent(onboardingId)}`, payload);
  return { onboarding: data.onboarding, warning: data.warning ?? null };
}

export async function uploadOnboardingDocument(onboardingId: string, name: string, url: string, remark?: string): Promise<DemandOnboarding> {
  const { data } = await api.post(`/onboarding/${encodeURIComponent(onboardingId)}/documents`, { name, url, remark });
  return data.onboarding;
}

export async function uploadOnboardingDocumentFile(onboardingId: string, name: string, file: File): Promise<DemandOnboarding> {
  const body = new FormData();
  body.append('name', name);
  body.append('file', file);
  const { data } = await api.post(`/onboarding/${encodeURIComponent(onboardingId)}/documents`, body);
  return data.onboarding;
}

/* ─────────────── Candidate cross-demand history ─────────────── */
export interface CandidateDemandHistoryItem {
  id: string;
  demand_id: string;
  current_status: string;
  is_active: boolean;
  final_result: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  demands: { request_id: string; skill_description: string; company_name?: string | null; client_name?: string | null; status: string } | null;
}

export async function getCandidateDemandHistory(candidateId: string, excludeDemandId?: string): Promise<CandidateDemandHistoryItem[]> {
  const params: Record<string, string> = {};
  if (excludeDemandId) params.exclude_demand_id = excludeDemandId;
  const { data } = await api.get(`/candidates/${encodeURIComponent(candidateId)}/demand-history`, { params });
  return data.history || [];
}

/* ─────────────── Super Admin settings ─────────────── */
export async function getSuperAdminSettings(includeInactive = false): Promise<SuperAdminSettingsDF> {
  const { data } = await api.get(`/admin/settings/demand-fulfillment${includeInactive ? '?includeInactive=true' : ''}`);
  return data;
}

export async function toggleOnboardingDocument(name: string, isActive: boolean): Promise<void> {
  await api.put(`/admin/settings/demand-fulfillment/onboarding-documents/${encodeURIComponent(name)}/toggle`, { is_active: isActive });
}

export async function toggleBgvChecklistItem(name: string, isActive: boolean): Promise<void> {
  await api.put(`/admin/settings/demand-fulfillment/bgv-checklist/${encodeURIComponent(name)}/toggle`, { is_active: isActive });
}

export async function updateSuperAdminSettings(payload: SuperAdminSettingsPatch): Promise<void> {
  await api.put('/admin/settings/demand-fulfillment', payload);
}

export type { Candidate };

/* ─────────────── Onboarding steps ─────────────── */

export interface OnboardingStep {
  id: string;
  onboarding_id: string;
  template_step_id: string | null;
  name: string;
  details: string | null;
  requires_attachment: boolean;
  step_order: number;
  status: string;
  attachment_url: string | null;
  attachment_name: string | null;
  remark: string | null;
  completed_at: string | null;
  updated_at: string;
  updated_by_name?: string | null;
}

export interface OnboardingStepTemplate {
  id: string;
  name: string;
  details: string | null;
  requires_attachment: boolean;
  is_active: boolean;
  sort_order: number;
}

export async function getOnboardingSteps(onboardingId: string): Promise<{ steps: OnboardingStep[]; can_manage: boolean }> {
  const { data } = await api.get(`/onboarding/${encodeURIComponent(onboardingId)}/steps`);
  return { steps: data.steps ?? [], can_manage: !!data.can_manage };
}

export async function updateOnboardingStep(
  onboardingId: string,
  stepId: string,
  payload: { status?: string; remark?: string | null; clear_attachment?: boolean }
): Promise<OnboardingStep> {
  const { data } = await api.patch(`/onboarding/${encodeURIComponent(onboardingId)}/steps/${encodeURIComponent(stepId)}`, payload);
  return data.step;
}

export async function uploadOnboardingStepFile(onboardingId: string, stepId: string, file: File): Promise<OnboardingStep> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post(
    `/onboarding/${encodeURIComponent(onboardingId)}/steps/${encodeURIComponent(stepId)}/attachment`,
    body,
    { headers: { 'Content-Type': undefined } }
  );
  return data.step;
}

/** `companyId` null = the default list. */
export async function getOnboardingStepTemplates(companyId: string | null): Promise<{ steps: OnboardingStepTemplate[]; has_own_list: boolean }> {
  const { data } = await api.get('/onboarding-step-templates', { params: { companyId: companyId ?? 'default' } });
  return { steps: data.steps ?? [], has_own_list: !!data.has_own_list };
}

export async function saveOnboardingStepTemplates(
  companyId: string | null,
  steps: { id?: string | null; name: string; details?: string | null; requires_attachment?: boolean; is_active?: boolean }[]
): Promise<{ steps: OnboardingStepTemplate[]; has_own_list: boolean }> {
  const { data } = await api.put('/onboarding-step-templates', { company_id: companyId, steps });
  return { steps: data.steps ?? [], has_own_list: !!data.has_own_list };
}

/* ─────────────── Demand change log ─────────────── */

export interface DemandChangeLogEntry {
  id: string;
  at: string;
  scope: 'demand' | 'candidate' | 'assignment' | 'status';
  actor: string | null;
  subject: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
}

export async function getDemandChangeLog(requestId: string): Promise<DemandChangeLogEntry[]> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/change-log`);
  return data.entries ?? [];
}

/* ─────────────── Call Log + Instruction Log ─────────────── */

export interface DemandCallLogEntry {
  id: string;
  outcome: 'demand_match' | 'not_fit';
  fail_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by_name: string | null;
  caller_name: string | null;
  skill_group_id: string | null;
  skill_group_name: string | null;
  candidate_id: string;
  /** May this user edit the call / add the candidate to Sourcing. */
  can_edit: boolean;
  candidate: {
    full_name: string; phone: string | null; email: string | null; current_company: string | null; current_location: string | null;
    total_experience: string | null; availability: string | null; expected_ctc: number | null; source: string | null;
  } | null;
  moved_to_sourcing: boolean;
}

export interface DemandCallSummaryRow {
  user_id: string;
  name: string;
  role: string;
  calls: number;
  demand_match: number;
  not_fit: number;
}

export async function getDemandCallLogs(requestId: string): Promise<{ calls: DemandCallLogEntry[]; summary: DemandCallSummaryRow[]; can_log: boolean }> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/call-logs`);
  return { calls: data.calls ?? [], summary: data.summary ?? [], can_log: !!data.can_log };
}

export interface LogDemandCallResult {
  call: { id: string; outcome: string };
  candidate_id: string;
  reused_existing_candidate: boolean;
  /** Demand Match: whether this user may edit the candidate in the follow-up form. */
  can_edit_candidate: boolean;
}

export async function logDemandCall(requestId: string, payload: unknown): Promise<LogDemandCallResult> {
  const { data } = await api.post(`/demands/${encodeURIComponent(requestId)}/call-logs`, payload);
  return data;
}

export async function updateDemandCall(requestId: string, callId: string, payload: unknown): Promise<void> {
  await api.put(`/demands/${encodeURIComponent(requestId)}/call-logs/${encodeURIComponent(callId)}`, payload);
}

export interface AddCallToSourcingResult {
  moved_to_sourcing: boolean;
  already_in_pipeline: boolean;
}

/** Demand Match follow-up: put the call's candidate into this demand's Sourcing. */
export async function addCallCandidateToSourcing(requestId: string, callId: string): Promise<AddCallToSourcingResult> {
  const { data } = await api.post(`/demands/${encodeURIComponent(requestId)}/call-logs/${encodeURIComponent(callId)}/add-to-sourcing`);
  return data;
}

export interface DemandInstruction {
  id: string;
  source: string;
  instruction_date: string;
  content: string;
  created_by: string | null;
  created_by_name: string | null;
  created_by_role: string | null;
  created_at: string;
  updated_at: string;
  can_manage?: boolean;
}

export async function getDemandInstructions(requestId: string): Promise<{ instructions: DemandInstruction[]; can_add: boolean }> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/instructions`);
  return { instructions: data.instructions ?? [], can_add: !!data.can_add };
}

export async function saveDemandInstruction(
  requestId: string,
  id: string | null,
  values: { source: string; instruction_date: string; content: string }
): Promise<DemandInstruction> {
  const base = `/demands/${encodeURIComponent(requestId)}/instructions`;
  const { data } = id ? await api.put(`${base}/${encodeURIComponent(id)}`, values) : await api.post(base, values);
  return data.instruction;
}

export async function deleteDemandInstruction(requestId: string, id: string): Promise<void> {
  await api.delete(`/demands/${encodeURIComponent(requestId)}/instructions/${encodeURIComponent(id)}`);
}

/** Sourcing review (batch 4): submit a saved profile, or approve / reject a submitted one. */
export async function reviewSourcedProfile(
  requestId: string,
  dcId: string,
  payload: { action: 'submit' | 'submit_as_active' | 'approve' | 'reject'; remark?: string }
): Promise<void> {
  await api.post(`/demands/${encodeURIComponent(requestId)}/candidates/${encodeURIComponent(dcId)}/review`, payload);
}
