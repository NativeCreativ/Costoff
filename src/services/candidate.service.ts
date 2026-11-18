import { api } from '@/lib/axios';
import { Candidate } from '@/components/types';
import { CandidateFormState } from '@/components/candidates/CandidateFormModal';
import { PaginatedResult } from '@/lib/pagination';

export interface CandidateFilters {
  search?: string;
  source?: string;
  workMode?: string;
  /** Scopes results to candidates whose skills overlap this Demand's technology_stack. */
  requestId?: string;
  /** Only meaningful with `requestId`: when that demand has NO required skills, show every
   *  (not-already-pipelined) candidate instead of none. Opt-in — every other caller of
   *  `requestId` (e.g. "Add Existing Candidate") keeps the default "nothing to match" behavior. */
  allowAllWhenNoSkills?: boolean;
  page?: number;
  pageSize?: number;
}

export type DemandPickerCandidate = Candidate & {
  /** True when the candidate already has an ACTIVE entry in this demand's pipeline. */
  already_in_pipeline: boolean;
  /** Set for a candidate whose only entry in this demand is INACTIVE (rejected/dropped). */
  entryState?: 'inactive';
  previousStatus?: string;
};

export interface CandidatePickerPage {
  candidates: DemandPickerCandidate[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** The "Add Existing Candidate" picker: whole pool, keyset paginated, search done by the
 *  backend. `picker=all` is a separate opt-in from `requestId`'s skill-filtered behaviour,
 *  which the Interviews & Schedules candidate field still relies on. */
export async function getDemandCandidatePicker(params: {
  requestId: string;
  search?: string;
  cursor?: string | null;
}): Promise<CandidatePickerPage> {
  const query: Record<string, string> = { requestId: params.requestId, picker: 'all' };
  if (params.search) query.search = params.search;
  if (params.cursor) query.cursor = params.cursor;
  const { data } = await api.get('/candidates', { params: query });
  return {
    candidates: data.candidates || [],
    nextCursor: data.nextCursor ?? null,
    hasMore: !!data.hasMore,
  };
}

export interface DuplicateCandidateError {
  isDuplicate: true;
  code?: 'DUPLICATE_CANDIDATE';
  field?: 'email' | 'phone' | 'both';
  error: string;
  existingCandidate?: { id?: string; full_name: string; email: string };
  /** Only set when email and phone each matched a DIFFERENT existing candidate (field: 'both'). */
  secondCandidate?: { id: string; full_name: string; email: string | null };
}

function toCandidatePayload(form: CandidateFormState) {
  return {
    ...form,
    current_ctc: form.current_ctc ? parseFloat(form.current_ctc) : null,
    expected_ctc: form.expected_ctc ? parseFloat(form.expected_ctc) : null,
    available_from: form.available_from || null,
    linked_url: form.linked_url || null,
    // Work Mode is optional: a blank dropdown is '' in form state, same as every other
    // optional field here, and is sent as null rather than an empty string.
    work_mode: form.work_mode || null,
    // "" = no role category picked; the API stores null. Never derived from skills.
    skills_category_id: form.skills_category_id || null,
    // Offer details are only kept while "Offer in hand" is Yes; No clears them.
    offer_in_hand: form.offer_in_hand === 'yes',
    offer_company: form.offer_in_hand === 'yes' ? form.offer_company || null : null,
    offer_ctc: form.offer_in_hand === 'yes' && form.offer_ctc ? parseFloat(form.offer_ctc) : null,
    offer_doj: form.offer_in_hand === 'yes' ? form.offer_doj || null : null,
  };
}

export async function getCandidates(filters: CandidateFilters = {}): Promise<PaginatedResult<Candidate>> {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.source) params.source = filters.source;
  if (filters.workMode) params.workMode = filters.workMode;
  if (filters.requestId) params.requestId = filters.requestId;
  if (filters.allowAllWhenNoSkills) params.allowAllWhenNoSkills = 'true';
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  const { data } = await api.get('/candidates', { params });
  return {
    data: data.candidates || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

export async function createCandidate(form: CandidateFormState, requestId?: string): Promise<{ candidate: Candidate; submissionId: string | null }> {
  // requestId is the demand context. Required for recruiters (`ta`): the API refuses a
  // recruiter create without a demand they are allocated to, and links the new
  // candidate to that demand in the same call.
  const { data } = await api.post('/candidates', {
    ...toCandidatePayload(form),
    ...(requestId ? { requestId } : {}),
  });
  return { candidate: data.candidate, submissionId: data.submissionId ?? null };
}

export async function updateCandidate(id: string, form: CandidateFormState): Promise<Candidate> {
  const { data } = await api.put('/candidates', { id, ...toCandidatePayload(form) });
  return data.candidate;
}

export async function deleteCandidate(id: string): Promise<void> {
  await api.delete('/candidates', { params: { id } });
}

export interface BulkCandidateResultItem {
  candidate_id: string;
  success: boolean;
  error?: string;
}

export interface BulkCandidateResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: BulkCandidateResultItem[];
}

export async function bulkDeleteCandidates(candidateIds: string[]): Promise<BulkCandidateResult> {
  const { data } = await api.delete('/candidates/bulk-delete', { data: { candidate_ids: candidateIds } });
  return data;
}

export async function getCandidateHistory(candidateId: string): Promise<any> {
  const { data } = await api.get(`/candidates/${encodeURIComponent(candidateId)}/history`);
  return data;
}

export interface CandidateConversation {
  id: string;
  channel: string;
  content: string;
  created_at: string;
  demand_id: string | null;
  request_id: string | null;
  created_by_name: string | null;
}

export async function getCandidateConversations(candidateId: string): Promise<{ conversations: CandidateConversation[]; can_add: boolean }> {
  const { data } = await api.get(`/candidates/${encodeURIComponent(candidateId)}/conversations`);
  return { conversations: data.conversations ?? [], can_add: !!data.can_add };
}

export async function addCandidateConversation(
  candidateId: string,
  payload: { channel: string; content: string; demand_id?: string | null }
): Promise<CandidateConversation> {
  const { data } = await api.post(`/candidates/${encodeURIComponent(candidateId)}/conversations`, payload);
  return data.conversation;
}

export type CandidateFileKind = 'resume' | 'photo' | 'rtr';

/** Uploads a resume / photo / RTR file before the candidate is saved; the form keeps the url. */
export async function uploadCandidateFile(kind: CandidateFileKind, file: File): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);
  const { data } = await api.post('/uploads/candidate-file', formData, { headers: { 'Content-Type': undefined } });
  return { url: data.url, name: data.name };
}

/** The full PAN (only for someone who may edit the candidate). Null when none is saved. */
export async function getCandidatePan(candidateId: string): Promise<string | null> {
  const { data } = await api.get(`/candidates/${encodeURIComponent(candidateId)}/pan`);
  return data.pan ?? null;
}
