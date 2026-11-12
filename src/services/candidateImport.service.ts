import { api } from '@/lib/axios';
import type { CandidateImportFieldKey } from '@/constants/candidateImportFields';

export interface ParseCandidateImportResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
  mapping: Partial<Record<CandidateImportFieldKey, string>>;
}

export async function parseCandidateImportFile(file: File): Promise<ParseCandidateImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  // Let the browser set the multipart Content-Type (with boundary) itself — the shared
  // `api` client defaults to application/json, which would break a FormData upload.
  const { data } = await api.post('/candidates/bulk-import/parse', formData, { headers: { 'Content-Type': undefined } });
  return data;
}

export interface CandidateImportRowResult {
  row: number;
  full_name?: string;
  success: boolean;
  isDuplicate?: boolean;
  error?: string;
}

export interface CandidateImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  failureCount: number;
  results: CandidateImportRowResult[];
}

export async function bulkImportCandidates(
  mapping: Partial<Record<CandidateImportFieldKey, string>>,
  rows: Record<string, string>[]
): Promise<CandidateImportResult> {
  const { data } = await api.post('/candidates/bulk-import', { mapping, rows });
  return data;
}

export interface CandidateExportFilters {
  search?: string;
  source?: string;
  workMode?: string;
  requestId?: string;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  return qs.toString();
}

/** Same-origin GET download — the browser sends the session cookie automatically, same
 *  as any other same-origin navigation, so no fetch/blob handling is needed. */
export function getCandidateExportUrl(format: 'xlsx' | 'csv', filters: CandidateExportFilters = {}): string {
  const qs = buildQuery({
    format,
    search: filters.search,
    source: filters.source,
    workMode: filters.workMode,
    requestId: filters.requestId,
  });
  return `/api/candidates/export?${qs}`;
}

export function getCandidateImportTemplateUrl(format: 'xlsx' | 'csv'): string {
  return `/api/candidates/import-template?format=${format}`;
}
