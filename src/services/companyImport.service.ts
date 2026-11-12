import { api } from '@/lib/axios';
import type { CompanyImportFieldKey } from '@/constants/companyImportFields';

export interface ParseCompanyImportResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
  mapping: Partial<Record<CompanyImportFieldKey, string>>;
}

export async function parseCompanyImportFile(file: File): Promise<ParseCompanyImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  // Let the browser set the multipart Content-Type (with boundary) itself — the shared `api`
  // client defaults to application/json, which would break a FormData upload.
  const { data } = await api.post('/companies/bulk-import/parse', formData, { headers: { 'Content-Type': undefined } });
  return data;
}

/** One row of the import outcome. `skipped` is neither success nor failure — it is a company
 *  that already existed and was deliberately left alone. */
export type CompanyImportRowStatus = 'created' | 'skipped' | 'failed';

export interface CompanyImportRowResult {
  row: number;
  name?: string;
  status: CompanyImportRowStatus;
  error?: string;
}

export interface CompanyImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: CompanyImportRowResult[];
}

export async function bulkImportCompanies(
  mapping: Partial<Record<CompanyImportFieldKey, string>>,
  rows: Record<string, string>[]
): Promise<CompanyImportResult> {
  const { data } = await api.post('/companies/bulk-import', { mapping, rows });
  return data;
}

export interface CompanyExportFilters {
  search?: string;
  status?: string;
}

/** Same-origin GET download — the browser sends the session cookie automatically, same as any
 *  other same-origin navigation, so no fetch/blob handling is needed. */
export function getCompanyExportUrl(format: 'xlsx' | 'csv', filters: CompanyExportFilters = {}): string {
  const qs = new URLSearchParams();
  qs.set('format', format);
  if (filters.search) qs.set('search', filters.search);
  if (filters.status) qs.set('status', filters.status);
  return `/api/companies/export?${qs.toString()}`;
}

export function getCompanyImportTemplateUrl(format: 'xlsx' | 'csv'): string {
  return `/api/companies/import-template?format=${format}`;
}