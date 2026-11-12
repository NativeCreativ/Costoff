import * as XLSX from 'xlsx';

/**
 * Shared spreadsheet plumbing for every bulk-import flow (Demands, Companies, Candidates).
 *
 * This module owns exactly the parts that are NOT entity-specific: reading a workbook, the
 * row/size ceilings, and matching uploaded header names to a field list. Everything that IS
 * entity-specific — the field list itself, how a row maps to a payload, who may import — stays
 * with that entity's own `*.ImportFields.ts` + import service, so this file can never become a
 * second source of truth for any module's schema.
 */

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export interface ParsedWorkbook {
  headers: string[];
  /** Each row as a plain object keyed by its ORIGINAL uploaded header (not yet mapped to a system field). */
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
}

/** Parses an uploaded .xlsx/.xls/.csv buffer uniformly via SheetJS (xlsx) — the only
 *  parser in this project's dependencies that reads legacy binary .xls in addition to
 *  .xlsx/.csv; ExcelJS (used for export) cannot read .xls at all. */
export function parseWorkbookBuffer(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [], totalRows: 0, truncated: false };

  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: '' });
  if (matrix.length === 0) return { headers: [], rows: [], totalRows: 0, truncated: false };

  const headers = (matrix[0] || []).map((h) => String(h ?? '').trim());
  const dataRows = matrix.slice(1);
  const totalRows = dataRows.length;
  const truncated = totalRows > MAX_IMPORT_ROWS;
  const limitedRows = dataRows.slice(0, MAX_IMPORT_ROWS);

  const rows = limitedRows.map((rowArr) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = String(rowArr[i] ?? '').trim();
    });
    return obj;
  });

  return { headers, rows, totalRows, truncated };
}

/** One column a bulk-import file may provide. `K` is that module's field-key union. */
export interface BulkImportFieldDef<K extends string> {
  key: K;
  label: string;
  required: boolean;
  /** Case-insensitive header names this field auto-matches against when a file is uploaded. */
  readonly aliases: readonly string[];
  example: string;
  /** Shown next to the column-mapping dropdown and in the template's Field Guide sheet. */
  hint?: string;
}

/** Case/whitespace-insensitive match of an uploaded header to a field's label/aliases. */
export function guessFieldForHeader<K extends string>(header: string, fields: readonly BulkImportFieldDef<K>[]): K | null {
  const normalized = header.trim().toLowerCase();
  for (const field of fields) {
    if (field.label.toLowerCase() === normalized) return field.key;
    if (field.aliases.some((a) => a.toLowerCase() === normalized)) return field.key;
  }
  return null;
}

/** Column-mapping guess for every field, based on the uploaded headers — a starting
 *  point for the UI's mapping step, not a decision; the user confirms/changes it. */
export function guessFieldMapping<K extends string>(
  headers: string[],
  fields: readonly BulkImportFieldDef<K>[]
): Partial<Record<K, string>> {
  const mapping: Partial<Record<K, string>> = {};
  for (const header of headers) {
    const field = guessFieldForHeader(header, fields);
    if (field && !mapping[field]) mapping[field] = header;
  }
  return mapping;
}

/** Maps a raw uploaded row (keyed by original header) to system field keys, per the
 *  user-confirmed column mapping. Unmapped fields come through as ''. */
export function applyColumnMapping<K extends string>(
  rawRow: Record<string, string>,
  mapping: Partial<Record<K, string>>,
  fields: readonly BulkImportFieldDef<K>[]
): Record<K, string> {
  const result = {} as Record<K, string>;
  for (const field of fields) {
    const header = mapping[field.key];
    result[field.key] = header ? (rawRow[header] ?? '') : '';
  }
  return result;
}

/** Splits a comma-separated cell into a trimmed, non-empty list. Order is the file's. */
export function splitCommaList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Extension + size gate shared by every parse endpoint, so an oversized or unsupported
 *  upload is rejected with one consistent message instead of per-module wording. */
export function validateImportUpload(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return 'Only .xlsx, .xls and .csv files are supported';
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return `File is too large (max ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)}MB)`;
  }
  return null;
}