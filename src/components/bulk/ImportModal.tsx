'use client';

import { useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BulkImportFieldDef } from '@/lib/bulk/workbook';
import { downloadBulkErrorReport, type BulkImportOutcome, type BulkImportRowOutcome } from '@/lib/bulk/importResult';

/** Generic result of the parse step: headers, rows and the auto-guessed column mapping. */
export interface BulkParseResult<K extends string> {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
  mapping: Partial<Record<K, string>>;
}

const PREVIEW_ROW_COUNT = 5;

interface BulkImportModalProps<K extends string> {
  /** Modal title, e.g. "Import Demands". */
  title: string;
  subtitle: string;
  /** Singular noun for the file picker copy, e.g. "Demands" / "Companies". */
  entityLabel: string;
  /** Prefix of the template/error-report filenames, e.g. "Demand". */
  fileLabel: string;
  fields: BulkImportFieldDef<K>[];
  getTemplateUrl: (format: 'xlsx' | 'csv') => string;
  parseFile: (file: File) => Promise<BulkParseResult<K>>;
  runImport: (mapping: Partial<Record<K, string>>, rows: Record<string, string>[]) => Promise<unknown>;
  /** Adapts the caller's own wire result into the shared outcome shape. */
  toOutcome: (result: unknown) => BulkImportOutcome;
  onClose: () => void;
  onDone: () => void;
}

type Step = 'upload' | 'mapping' | 'result';

/**
 * Upload → auto column mapping → preview → import → per-row result summary.
 *
 * ONE modal for every bulk-import flow; the module supplies its field list, its two service
 * calls and the adapter from its own result shape. Upload, mapping, the required-field warning,
 * the 5-row preview and the summary tiles are therefore identical everywhere by construction.
 */
export function BulkImportModal<K extends string>({
  title,
  subtitle,
  entityLabel,
  fileLabel,
  fields,
  getTemplateUrl,
  parseFile,
  runImport,
  toOutcome,
  onClose,
  onDone,
}: BulkImportModalProps<K>) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [mapping, setMapping] = useState<Partial<Record<K, string>>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportOutcome | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const missingRequired = useMemo(
    () => fields.filter((f) => f.required && !mapping[f.key]),
    [fields, mapping]
  );

  // Three states the mapping screen can be in, per field auto-match coverage:
  //   - every field auto-matched      -> skip the mapping grid entirely, go straight to preview
  //   - some matched, some didn't     -> only show the ones that need mapping
  //   - none matched                  -> show the full grid
  const unmappedFields = useMemo(() => fields.filter((f) => !mapping[f.key]), [fields, mapping]);
  const mappedFields = useMemo(() => fields.filter((f) => mapping[f.key]), [fields, mapping]);
  const allMapped = unmappedFields.length === 0;
  const noneMapped = mappedFields.length === 0;
  const fieldsToShowInGrid = noneMapped ? fields : unmappedFields;
  const mappedColumns = fields.filter((f) => mapping[f.key]);

  const handleFileSelected = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const data = await parseFile(file);
      setHeaders(data.headers);
      setRows(data.rows);
      setTotalRows(data.totalRows);
      setTruncated(data.truncated);
      setMapping(data.mapping);
      setStep('mapping');
    } catch (err) {
      setParseError(isAxiosError(err) ? err.response?.data?.error || 'Failed to parse the file' : 'Failed to parse the file');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImportError(null);
    setImporting(true);
    try {
      const res = await runImport(mapping, rows);
      setResult(toOutcome(res));
    } catch (err) {
      setImportError(isAxiosError(err) ? err.response?.data?.error || 'Import failed' : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const close = () => (result ? onDone() : onClose());

  const renderRowResult = (r: BulkImportRowOutcome) => (
    <div key={r.row} className="flex items-center justify-between rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.8rem]">
      <span>Row {r.row}{r.label ? ` — ${r.label}` : ''}</span>
      {r.status === 'created' ? (
        <Badge className="border-transparent bg-[#dcfce7] text-[0.7rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Imported</Badge>
      ) : r.status === 'skipped' ? (
        <span className="flex items-center gap-2">
          <Badge className="border-transparent bg-[#e2e8f0] text-[0.7rem] font-semibold text-[#475569] hover:bg-[#e2e8f0]">Skipped</Badge>
          <span className="max-w-[50%] text-right text-[0.72rem] text-[#64748b]">{r.error}</span>
        </span>
      ) : (
        <span className="max-w-[60%] text-right text-[0.72rem] text-[#dc2626]">{r.error}</span>
      )}
    </div>
  );

  return (
    <Modal title={title} subtitle={subtitle} width="1100px" offsetForSidebar onClose={close} closeDisabled={parsing || importing}>
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[0.83rem] text-[#64748b]">
            <span>New to this?</span>
            <a href={getTemplateUrl('xlsx')} className="font-semibold text-[#2563eb] underline">Download Template (.xlsx)</a>
            <span>·</span>
            <a href={getTemplateUrl('csv')} className="font-semibold text-[#2563eb] underline">Download Template (.csv)</a>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 py-10 text-center">
            <p className="text-[0.85rem] text-[#475569]">Select a .xlsx, .xls or .csv file of {entityLabel} to import</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={parsing}>
              {parsing ? 'Parsing…' : 'Choose File'}
            </Button>
            {fileName && !parsing && <span className="text-[0.78rem] text-[#94a3b8]">{fileName}</span>}
          </div>

          {parseError && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.82rem] text-[#dc2626]">{parseError}</div>}
        </div>
      )}

      {step === 'mapping' && !result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-[0.83rem] text-[#64748b]">
              <strong className="text-[#0f172a]">{fileName}</strong> — {totalRows} row{totalRows === 1 ? '' : 's'} found
              {truncated && <span className="ml-1 text-[#dc2626]">(only the first {rows.length} will be imported — file exceeds the row limit)</span>}
            </div>
            <Button variant="outline" onClick={() => setStep('upload')}>Choose a different file</Button>
          </div>

          {allMapped ? (
            <div className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[0.8rem] text-[#166534]">
              ✓ All columns matched automatically — nothing left to map.
            </div>
          ) : (
            <div>
              <div className="mb-2 text-[0.8rem] font-semibold text-[#475569]">
                {noneMapped ? 'Map your columns to the import fields' : 'A few columns need mapping'}
              </div>
              {!noneMapped && (
                <div className="mb-2 text-[0.78rem] text-[#64748b]">
                  {mappedFields.length} column{mappedFields.length === 1 ? '' : 's'} matched automatically ({mappedFields.map((f) => f.label).join(', ')}). Only the ones below need your input.
                </div>
              )}
              <div className="grid max-h-[320px] grid-cols-2 gap-x-6 gap-y-2 overflow-y-auto rounded-md border border-[#e2e8f0] p-3">
                {fieldsToShowInGrid.map((field) => (
                  <div key={field.key} className="flex items-center justify-between gap-3">
                    <label className="flex-1 text-[0.82rem] text-[#334155]">
                      {field.label}
                      {field.required && <span className="text-[#dc2626]"> *</span>}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))}
                      className="w-[55%] rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[0.8rem]"
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {missingRequired.length > 0 && (
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.78rem] text-[#92400e]">
              Required fields not yet mapped: {missingRequired.map((f) => f.label).join(', ')}
            </div>
          )}

          <div>
            <div className="mb-2 text-[0.8rem] font-semibold text-[#475569]">Preview (first {Math.min(PREVIEW_ROW_COUNT, rows.length)} rows, as mapped)</div>
            <div className="overflow-x-auto rounded-md border border-[#e2e8f0]">
              <table className="w-full text-left text-[0.76rem]">
                <thead className="bg-[#f8fafc] font-semibold text-[#475569]">
                  <tr>
                    {mappedColumns.map((f) => (
                      <th key={f.key} className="whitespace-nowrap px-2.5 py-2">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {rows.slice(0, PREVIEW_ROW_COUNT).map((row, i) => (
                    <tr key={i}>
                      {mappedColumns.map((f) => (
                        <td key={f.key} className="max-w-[160px] truncate whitespace-nowrap px-2.5 py-2 text-[#334155]">{row[mapping[f.key]!] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importError && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.82rem] text-[#dc2626]">{importError}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button>
            <Button onClick={handleImport} disabled={missingRequired.length > 0 || importing}>
              {importing
                ? `Importing ${rows.length} row${rows.length === 1 ? '' : 's'}…`
                : `Import ${rows.length} Row${rows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className={`grid gap-2.5 ${result.skippedCount > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#0f172a]">{result.totalRows}</div>
              <div className="text-[0.72rem] text-[#64748b]">Total Rows</div>
            </div>
            <div className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#16a34a]">{result.successCount}</div>
              <div className="text-[0.72rem] text-[#166534]">Imported</div>
            </div>
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#dc2626]">{result.failureCount}</div>
              <div className="text-[0.72rem] text-[#991b1b]">Failed</div>
            </div>
            {result.skippedCount > 0 && (
              <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-center">
                <div className="text-[1.3rem] font-bold text-[#475569]">{result.skippedCount}</div>
                <div className="text-[0.72rem] text-[#64748b]">Skipped</div>
              </div>
            )}
            <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#0f172a]">{result.totalRows > 0 ? Math.round((result.successCount / result.totalRows) * 100) : 0}%</div>
              <div className="text-[0.72rem] text-[#64748b]">Success Rate</div>
            </div>
          </div>

          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {result.results.map(renderRowResult)}
          </div>

          <div className="flex justify-between gap-2">
            {result.failureCount > 0 || result.skippedCount > 0 ? (
              <Button variant="outline" onClick={() => downloadBulkErrorReport(fileLabel, result.results)}>
                Download Error Report
              </Button>
            ) : <span />}
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}