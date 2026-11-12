import { api } from '@/lib/axios';
import { Interview } from '@/components/types';
import { InterviewFormState } from '@/components/interviews/InterviewFormModal';

export interface FilterOption {
  value: string;
  label: string;
}

export interface InterviewFilters {
  search?: string;
  mode?: string;
  status?: string;
  result?: string;
  round?: string;
  company?: string;
  am?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface InterviewsResult {
  interviews: Interview[];
  roundOptions: string[];
  modeOptions: string[];
  companyOptions: FilterOption[];
  amOptions: FilterOption[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getInterviews(filters: InterviewFilters = {}): Promise<InterviewsResult> {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.mode) params.mode = filters.mode;
  if (filters.status) params.status = filters.status;
  if (filters.result) params.result = filters.result;
  if (filters.round) params.round = filters.round;
  if (filters.company) params.company = filters.company;
  if (filters.am) params.am = filters.am;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  const { data } = await api.get('/interviews', { params });
  return {
    interviews: data.interviews || [],
    roundOptions: data.roundOptions || [],
    modeOptions: data.modeOptions || [],
    companyOptions: data.companyOptions || [],
    amOptions: data.amOptions || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

export async function createInterview(form: InterviewFormState): Promise<Interview> {
  const { data } = await api.post('/interviews', form);
  return data.interview;
}

export async function updateInterviewStatus(id: string, status: string): Promise<Interview> {
  const { data } = await api.put('/interviews', { id, status });
  return data.interview;
}

/** Full-field edit (distinct from the status-only updateInterviewStatus above) — hits the
 *  richer PATCH /api/interviews/[id] endpoint (submission-event logging, pipeline auto-advance). */
export async function updateInterview(id: string, form: Partial<InterviewFormState>): Promise<Interview> {
  const { data } = await api.patch(`/interviews/${id}`, form);
  return data.interview;
}

export async function deleteInterview(id: string): Promise<void> {
  await api.delete('/interviews', { params: { id } });
}

export interface BulkInterviewResultItem {
  interview_id: string;
  label?: string;
  success: boolean;
  error?: string;
}

export interface BulkInterviewResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: BulkInterviewResultItem[];
}

/** No remark field (unlike the Demand bulk-status endpoint, which requires one). `result` is
 *  required by the API only when `status` is 'Completed'; ignored for any other status. */
export async function bulkChangeInterviewStatus(
  interviewIds: string[],
  status: string,
  result?: string
): Promise<BulkInterviewResult> {
  const { data } = await api.patch('/interviews/bulk-status', {
    interview_ids: interviewIds,
    status,
    ...(result ? { result } : {}),
  });
  return data;
}

export async function bulkDeleteInterviews(interviewIds: string[]): Promise<BulkInterviewResult> {
  const { data } = await api.delete('/interviews/bulk-delete', { data: { interview_ids: interviewIds } });
  return data;
}

export async function getInterviewFilterOptions(type: string, search = ''): Promise<FilterOption[]> {
  const { data } = await api.get('/interviews/filter-options', {
    params: { type, search, limit: 50 },
  });
  return data.options || [];
}
