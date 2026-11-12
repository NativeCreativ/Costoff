'use client';

import { useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CANDIDATE_IMPORT_FIELDS, type CandidateImportFieldKey } from '@/constants/candidateImportFields';
import { useParseCandidateImportMutation, useBulkImportCandidatesMutation } from '@/queries/candidates/useCandidateImportMutations';
import { getCandidateImportTemplateUrl } from '@/services/candidateImport.service';
import type { CandidateImportResult } from '@/services/candidateImport.service';

interface CandidateImportModalProps {
  onClose: () => void;
  onDone: () => void;
}

type Step = 'upload' | 'mapping' | 'result';

const PREVIEW_ROW_COUNT = 5;

/** Builds a downloadable CSV of the failed/duplicate rows + reasons, entirely
 *  client-side — the server's per-row result array already has everything needed, so no
 *  extra round trip. */
function downloadErrorReport(results: CandidateImportResult['results']) {
  const failed = results.filter((r) => !r.success);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    'Row,Full Name,Reason,Type',
    ...failed.map((r) => [r.row, r.full_name || '', r.error || '', r.isDuplicate ? 'Duplicate' : 'Failed'].map((v) => escape(String(v))).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Candidate_Import_Errors_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CandidateImportModal({ onClose, onDone }: CandidateImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [mapping, setMapping] = useState<Partial<Record<CandidateImportFieldKey, string>>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<CandidateImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseMutation = useParseCandidateImportMutation();
  const importMutation = useBulkImportCandidatesMutation();

  const missingRequired = useMemo(
    () => CANDIDATE_IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]),
    [mapping]
  );

  // Three states the mapping screen can be in, per field auto-match coverage:
  //   - every field auto-matched      -> skip the mapping grid entirely, go straight to preview
  //   - some matched, some didn't     -> only show the ones that need mapping
  //   - none matched                  -> show the full grid, same as before
  const unmappedFields = useMemo(() => CANDIDATE_IMPORT_FIELDS.filter((f) => !mapping[f.key]), [mapping]);
  const mappedFields = useMemo(() => CANDIDATE_IMPORT_FIELDS.filter((f) => mapping[f.key]), [mapping]);
  const allMapped = unmappedFields.length === 0;
  const noneMapped = mappedFields.length === 0;
  const fieldsToShowInGrid = noneMapped ? CANDIDATE_IMPORT_FIELDS : unmappedFields;

  const handleFileSelected = (file: File) => {
    setParseError(null);
    setFileName(file.name);
    parseMutation.mutate(file, {
      onSuccess: (data) => {
        setHeaders(data.headers);
        setRows(data.rows);
        setTotalRows(data.totalRows);
        setTruncated(data.truncated);
        setMapping(data.mapping);
        setStep('mapping');
      },
      onError: (err) => {
        setParseError(isAxiosError(err) ? err.response?.data?.error || 'Failed to parse the file' : 'Failed to parse the file');
      },
    });
  };

  const handleImport = () => {
    setImportError(null);
    importMutation.mutate(
      { mapping, rows },
      {
        onSuccess: (res) => setResult(res),
        onError: (err) => setImportError(isAxiosError(err) ? err.response?.data?.error || 'Import failed' : 'Import failed'),
      }
    );
  };

  const close = () => (result ? onDone() : onClose());

  return (
    <Modal title="Import Candidates" subtitle="Upload a .xlsx, .xls or .csv file of candidates to create in bulk" width="1100px" offsetForSidebar onClose={close} closeDisabled={parseMutation.isPending || importMutation.isPending}>
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[0.83rem] text-[#64748b]">
            <span>New to this?</span>
            <a href={getCandidateImportTemplateUrl('xlsx')} className="font-semibold text-[#2563eb] underline">Download Template (.xlsx)</a>
            <span>·</span>
            <a href={getCandidateImportTemplateUrl('csv')} className="font-semibold text-[#2563eb] underline">Download Template (.csv)</a>
          </div>

          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 py-10 text-center"
          >
            <p className="text-[0.85rem] text-[#475569]">Select a .xlsx, .xls or .csv file of Candidates to import</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={parseMutation.isPending}>
              {parseMutation.isPending ? 'Parsing…' : 'Choose File'}
            </Button>
            {fileName && !parseMutation.isPending && <span className="text-[0.78rem] text-[#94a3b8]">{fileName}</span>}
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
                {noneMapped ? 'Map your columns to Candidate fields' : 'A few columns need mapping'}
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
                    {CANDIDATE_IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <th key={f.key} className="whitespace-nowrap px-2.5 py-2">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {rows.slice(0, PREVIEW_ROW_COUNT).map((row, i) => (
                    <tr key={i}>
                      {CANDIDATE_IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
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
            <Button variant="outline" onClick={onClose} disabled={importMutation.isPending}>Cancel</Button>
            <Button onClick={handleImport} disabled={missingRequired.length > 0 || importMutation.isPending}>
              {importMutation.isPending ? `Importing ${rows.length} row${rows.length === 1 ? '' : 's'}…` : `Import ${rows.length} Row${rows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-2.5">
            <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#0f172a]">{result.totalRows}</div>
              <div className="text-[0.72rem] text-[#64748b]">Total Rows</div>
            </div>
            <div className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#16a34a]">{result.successCount}</div>
              <div className="text-[0.72rem] text-[#166534]">Imported</div>
            </div>
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#92400e]">{result.duplicateCount}</div>
              <div className="text-[0.72rem] text-[#92400e]">Duplicates</div>
            </div>
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#dc2626]">{result.failureCount}</div>
              <div className="text-[0.72rem] text-[#991b1b]">Failed</div>
            </div>
            <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-center">
              <div className="text-[1.3rem] font-bold text-[#0f172a]">{result.totalRows > 0 ? Math.round((result.successCount / result.totalRows) * 100) : 0}%</div>
              <div className="text-[0.72rem] text-[#64748b]">Success Rate</div>
            </div>
          </div>

          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {result.results.map((r) => (
              <div key={r.row} className="flex items-center justify-between rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.8rem]">
                <span>Row {r.row}{r.full_name ? ` — ${r.full_name}` : ''}</span>
                {r.success ? (
                  <Badge className="border-transparent bg-[#dcfce7] text-[0.7rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Imported</Badge>
                ) : r.isDuplicate ? (
                  <span className="max-w-[60%] text-right text-[0.72rem] text-[#92400e]">Duplicate — {r.error}</span>
                ) : (
                  <span className="max-w-[60%] text-right text-[0.72rem] text-[#dc2626]">{r.error}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            {(result.failureCount > 0 || result.duplicateCount > 0) ? (
              <Button variant="outline" onClick={() => downloadErrorReport(result.results)}>Download Error Report</Button>
            ) : <span />}
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
