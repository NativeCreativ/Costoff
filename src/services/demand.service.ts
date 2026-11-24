import { api } from '@/lib/axios';
import { Demand } from '@/components/types';
import { DemandFormState } from '@/components/demands/DemandFormModal';
import { PaginatedResult } from '@/lib/pagination';

export interface DemandFilters {
  search?: string;
  status?: string;
  /**
   * Comma-separated demand statuses to EXCLUDE. Used by the Schedule New Interview Request ID
   * dropdown to hide terminal demands (Closure / Cancelled) — it is a demand-status rule only,
   * never a company-status one.
   */
  excludeStatuses?: string;
  priority?: string;
  roleType?: string;
  redFlagsOnly?: boolean;
  /** Narrows to demands the current user can MANAGE (own, for an Account Manager; are
   *  assigned to, for a Recruiter) rather than every demand they may merely view — for
   *  pickers like "which Requirement is this new candidate for?". */
  manageable?: boolean;
  /** Narrows to demands the user may upload profiles to — for "which Requirement is this new
   *  candidate for?". A Recruiter gets every demand; an AM only their own. */
  uploadable?: boolean;
  /** "My demands": only demands the user is assigned to (AM / SPOC / Recruiter). */
  assignedToMe?: boolean;
  page?: number;
  pageSize?: number;
}

function toDemandPayload(form: DemandFormState) {
  // The round editor keeps structured objects in the form; the hidden input holds them as JSON.
  // A non-empty list parses straight through. An empty-looking hidden field is otherwise
  // omitted entirely (Add Demand's existing behavior, and the Edit form's "field never
  // touched" case) so the demand keeps inheriting Company -> global rather than being pinned
  // to an empty override by accident.
  let interviewRounds: unknown[] | undefined;
  if (form.interview_rounds) {
    try {
      const parsed = JSON.parse(form.interview_rounds);
      if (Array.isArray(parsed) && parsed.length > 0) interviewRounds = parsed;
    } catch {
      interviewRounds = undefined;
    }
  }

  // Edit Demand only: set when the user deliberately emptied a previously non-empty rounds
  // list and confirmed the "Remove all rounds from this demand?" prompt — the one case where
  // an EXPLICIT empty array must reach the API (clearing this demand's own override) rather
  // than being treated as "not sent".
  const explicitlyCleared = form.interview_rounds_cleared === true;

  return {
    ...form,
    interview_rounds: undefined, // replaced below
    interview_rounds_cleared: undefined, // frontend-only signal, never sent as its own field
    ...(interviewRounds ? { interview_rounds: interviewRounds } : explicitlyCleared ? { interview_rounds: [] } : {}),
    compensation_currency_id: form.compensation_currency_id || null,
    compensation_type_id: form.compensation_type_id || null,
    // Sent exactly as typed; "" means "not specified". The backend stores this verbatim.
    compensation_min: form.compensation_min === '' ? null : form.compensation_min ?? null,
    compensation_max: form.compensation_max === '' ? null : form.compensation_max ?? null,
    locations: form.locations ?? [],
    end_client_id: form.end_client_id || null,
    is_niche: form.is_niche ?? false,
    rate_conversion_formula: form.rate_conversion_formula ?? null,
    demand_type: form.demand_type || null,
    engagement_type: form.engagement_type || null,
    client_demand_id: form.client_demand_id || null,
    intermediary_partner: form.intermediary_partner || null,
    shift_timings: form.shift_timings || null,
    comments: form.comments || null,
    other_details: form.other_details || null,
    customer_jd: form.customer_jd || null,
    customer_jd_file_url: form.customer_jd_file_url || null,
    customer_jd_file_name: form.customer_jd_file_url ? form.customer_jd_file_name || null : null,
    total_experience: form.total_experience || null,
    relevant_experience: form.relevant_experience || null,
    certifications: form.certifications ?? [],
    client_spoc_ids: form.client_spoc_ids ?? [],
    work_modes: form.work_modes,
    // Older API readers still look at the single column; the route derives it too.
    work_mode: form.work_modes[0],
    spoc_profile_id: form.spoc_profile_id || null,
    // "" = no role category picked; the API stores null. Never derived from required_skills.
    skills_category_id: form.skills_category_id || null,
  };
}

export async function getDemands(filters: DemandFilters = {}): Promise<PaginatedResult<Demand>> {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.excludeStatuses) params.excludeStatuses = filters.excludeStatuses;
  if (filters.priority) params.priority = filters.priority;
  if (filters.roleType) params.roleType = filters.roleType;
  if (filters.redFlagsOnly) params.redFlagsOnly = 'true';
  if (filters.manageable) params.manageable = 'true';
  if (filters.uploadable) params.uploadable = 'true';
  if (filters.assignedToMe) params.assignedToMe = 'true';
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  const { data } = await api.get('/demands', { params });
  return {
    data: data.demands || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

/** `clonedFromDemandId` is sent only by the Clone Demand flow — the backend re-validates
 *  (ownership + the source demand already being Closed) rather than trusting it. */
export async function createDemand(form: DemandFormState, clonedFromDemandId?: string): Promise<Demand> {
  const payload = clonedFromDemandId
    ? { ...toDemandPayload(form), cloned_from_demand_id: clonedFromDemandId }
    : toDemandPayload(form);
  const { data } = await api.post('/demands', payload);
  return data.demand;
}

export async function updateDemand(id: string, form: DemandFormState): Promise<Demand> {
  const { data } = await api.put('/demands', { id, ...toDemandPayload(form) });
  return data.demand;
}

/** Availability probe for the Add Demand form's inline duplicate error. */
export async function checkDemandRequestIdAvailable(requestId: string, excludeId?: string): Promise<boolean> {
  const params: Record<string, string> = {};
  if (requestId) params.requestId = requestId;
  if (excludeId) params.exclude = excludeId;
  const { data } = await api.get('/demands/request-id-check', { params });
  return !!data.available;
}

/** Uploads a Customer JD file before the demand is saved; the demand write stores the url. */
export async function uploadCustomerJdFile(file: File): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  // Let the browser set the multipart Content-Type (with boundary) itself.
  const { data } = await api.post('/uploads/jd', formData, { headers: { 'Content-Type': undefined } });
  return { url: data.url, name: data.name };
}

export async function deleteDemand(id: string): Promise<void> {
  await api.delete('/demands', { params: { id } });
}
