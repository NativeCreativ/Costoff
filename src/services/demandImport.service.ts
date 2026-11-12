import { api } from '@/lib/axios';
import type { DemandImportFieldKey } from '@/constants/demandImportFields';

export interface ParseDemandImportResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
  mapping: Partial<Record<DemandImportFieldKey, string>>;
}

export async function parseDemandImportFile(file: File): Promise<ParseDemandImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  // Let the browser set the multipart Content-Type (with boundary) itself — the shared
  // `api` client defaults to application/json, which would break a FormData upload.
  const { data } = await api.post('/demands/bulk-import/parse', formData, { headers: { 'Content-Type': undefined } });
  return data;
}

export interface DemandImportRowResult {
  row: number;
  request_id?: string;
  success: boolean;
  error?: string;
}

export interface DemandImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failureCount: number;
  results: DemandImportRowResult[];
}

export async function bulkImportDemands(
  mapping: Partial<Record<DemandImportFieldKey, string>>,
  rows: Record<string, string>[]
): Promise<DemandImportResult> {
  const { data } = await api.post('/demands/bulk-import', { mapping, rows });
  return data;
}

export interface DemandExportFilters {
  search?: string;
  status?: string;
  priority?: string;
  roleType?: string;
  redFlagsOnly?: boolean;
  assignedToMe?: boolean;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  return qs.toString();
}

/** Same-origin GET download — the browser sends the session cookie automatically, same
 *  as any other same-origin navigation, so no fetch/blob handling is needed. */
export function getDemandExportUrl(format: 'xlsx' | 'csv', filters: DemandExportFilters = {}): string {
  const qs = buildQuery({
    format,
    search: filters.search,
    status: filters.status,
    priority: filters.priority,
    roleType: filters.roleType,
    redFlagsOnly: filters.redFlagsOnly ? 'true' : undefined,
    assignedToMe: filters.assignedToMe ? 'true' : undefined,
  });
  return `/api/demands/export?${qs}`;
}

export function getDemandImportTemplateUrl(format: 'xlsx' | 'csv'): string {
  return `/api/demands/import-template?format=${format}`;
}
