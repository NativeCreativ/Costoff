/**
 * Shared result/report shape for every bulk-import flow.
 *
 * A module's OWN service keeps its wire shape (Demands answers `success: boolean` per row, to
 * stay backward compatible); it is adapted into `BulkImportOutcome` at the component boundary.
 * That is why `status` has three states rather than two — the Company import can report a row
 * that was deliberately NOT written because the record already exists, which is neither a
 * success nor a failure.
 */
export type BulkRowStatus = 'created' | 'skipped' | 'failed';

export interface BulkImportRowOutcome {
  /** 1-based data-row number in the uploaded file (header excluded). */
  row: number;
  /** Human label for the row, e.g. a company name or a Request ID. */
  label?: string;
  status: BulkRowStatus;
  /** Present for skipped/failed rows. */
  error?: string;
}

export interface BulkImportOutcome {
  totalRows: number;
  successCount: number;
  failureCount: number;
  /** Rows deliberately not written because the record already existed. */
  skippedCount: number;
  results: BulkImportRowOutcome[];
}

/** Builds a downloadable CSV of the skipped + failed rows with their reasons, entirely
 *  client-side — the server's per-row result array already carries everything needed. */
export function downloadBulkErrorReport(entityLabel: string, results: BulkImportRowOutcome[]) {
  const problems = results.filter((r) => r.status !== 'created');
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    'Row,Record,Status,Reason',
    ...problems.map((r) =>
      [r.row, r.label || '', r.status === 'skipped' ? 'Skipped' : 'Failed', r.error || '']
        .map((v) => escape(String(v)))
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityLabel}_Import_Errors_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}