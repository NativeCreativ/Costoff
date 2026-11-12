import { api } from '@/lib/axios';
import type { Company, ClientSpoc } from '@/components/types';
import type { ClientSpocItem } from '@/components/masterData/spoc.schema';
import { PaginatedResult } from '@/lib/pagination';

export interface CompanyFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CompanyInterviewRoundConfig {
  round_id: string;
  name: string;
  mode: string | null;
  order: number;
  mandatory: boolean;
  isActive: boolean;
  /** How many of this company's own demands (or a candidate interview) already use this round.
   *  Only populated by GET/PUT .../interview-rounds. */
  usage?: number;
  /** Convenience flag over `usage` — a round the Clients Master editor may not rename, change
   *  the mode of, or delete. */
  inUse?: boolean;
}

/** GET /api/companies — paginated + searchable. Also feeds the Demand form's Company dropdown. */
export async function getCompanies(filters: CompanyFilters = {}): Promise<PaginatedResult<Company>> {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  const { data } = await api.get('/companies', { params });
  return {
    data: data.companies || [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

/** GET /api/companies/[id] — one company with its configured interview rounds. */
export async function getCompany(id: string): Promise<Company> {
  const { data } = await api.get(`/companies/${id}`);
  return data.company;
}

export interface CompanyFormPayload {
  name: string;
  client_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: string;
  /** Optional company Account Manager (profiles.id). Null / omitted means "no AM". */
  account_manager_id?: string | null;
  spocs?: ClientSpocItem[];
  /**
   * Optional initial interview rounds, saved together with the company in one request.
   * Omit or pass `[]` for "no company configuration yet" — the company then falls back to the
   * global default rounds until a demand seeds them.
   */
  interview_rounds?: CompanyRoundWrite[];
}

/** One round as the Company forms send it: identified by name, master id, or both. */
export interface CompanyRoundWrite {
  round_id?: string | null;
  name?: string | null;
  mode?: string | null;
  order?: number;
  mandatory?: boolean;
  isActive?: boolean;
}

export async function createCompany(form: CompanyFormPayload): Promise<Company> {
  const { data } = await api.post('/companies', form);
  return data.company;
}

/**
 * Edit a Company. Returns the updated company plus how many linked demands had their
 * denormalized company copy re-synced (the name/email mirror those consumers read).
 */
export async function updateCompany(
  id: string,
  form: CompanyFormPayload
): Promise<{ company: Company; syncedDemands: number }> {
  const { data } = await api.put(`/companies/${id}`, form);
  return { company: data.company, syncedDemands: data.syncedDemands ?? 0 };
}

/**
 * Inline quick-create from the Demand form ("+ Add Company"). Collects only a name; the route
 * creates a real master row or reuses the existing one with the same normalized name, so
 * `created: false` simply means an equivalent company already existed.
 */
export async function quickCreateCompany(name: string): Promise<{ company: Company; created: boolean }> {
  const { data } = await api.post('/companies', { quick: true, name });
  return { company: data.company, created: !!data.created };
}

export async function getCompanyInterviewRounds(
  id: string
): Promise<{ rounds: CompanyInterviewRoundConfig[]; hasConfig: boolean }> {
  const { data } = await api.get(`/companies/${id}/interview-rounds`);
  return { rounds: data.rounds || [], hasConfig: !!data.hasConfig };
}

/**
 * Replaces a company's configured interview rounds — the ONLY write that changes existing
 * company rounds (Edit Company in Clients Master).
 *
 * An empty `rounds` array is a meaningful save: it clears the configuration so the company
 * falls back to the global default. The server rejects a clear that would orphan a round an
 * existing demand or interview already uses (409 ROUND_IN_USE) and the error message names the
 * blocking round.
 */
export async function updateCompanyInterviewRounds(
  id: string,
  rounds: CompanyRoundWrite[],
  remark?: string
): Promise<CompanyInterviewRoundConfig[]> {
  const { data } = await api.put(`/companies/${id}/interview-rounds`, {
    rounds,
    remark: remark?.trim() || undefined,
  });
  return data.rounds || [];
}

/** GET /api/companies/dropdown — the Add Demand client picker. Role-scoped by the backend:
 *  super_admin sees all clients, account_manager sees only their own. */
export async function getCompaniesDropdown(search?: string): Promise<{ id: string; name: string; client_name: string | null }[]> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  const { data } = await api.get('/companies/dropdown', { params });
  return data.companies || [];
}
/** A client's SPOCs (active and inactive) for the demand form's SPOC picker. */
export async function getCompanySpocs(companyId: string): Promise<ClientSpoc[]> {
  const { data } = await api.get(`/companies/${encodeURIComponent(companyId)}/spocs`);
  return data.spocs ?? [];
}

/** "Add SPOC" from the demand form — appends one active SPOC to the client. */
export async function addCompanySpoc(companyId: string, spoc: ClientSpocItem): Promise<ClientSpoc> {
  const { data } = await api.post(`/companies/${encodeURIComponent(companyId)}/spocs`, spoc);
  return data.spoc;
}
