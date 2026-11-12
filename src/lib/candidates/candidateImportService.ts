import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db/prisma';
import { candidateApiSchema } from '@/components/candidates/candidate.schema';
import { normalizeEmail, normalizePhone } from '@/lib/candidateNormalize';
import { findDuplicateCandidate, duplicateCandidateMessage } from '@/lib/candidates/duplicateCheck';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { getResumeCapStatus } from '@/lib/demandFulfillment/resumeCap';
import { CANDIDATE_IMPORT_FIELDS, guessFieldForHeader, type CandidateImportFieldKey } from '@/constants/candidateImportFields';

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10MB

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

/** Column-mapping guess for every field, based on the uploaded headers — a starting
 *  point for the UI's mapping step, not a decision; the user confirms/changes it. */
export function guessMapping(headers: string[]): Partial<Record<CandidateImportFieldKey, string>> {
  const mapping: Partial<Record<CandidateImportFieldKey, string>> = {};
  for (const header of headers) {
    const field = guessFieldForHeader(header);
    if (field && !mapping[field]) mapping[field] = header;
  }
  return mapping;
}

export interface CandidateImportRowResult {
  row: number; // 1-based, matching the uploaded file's data rows (excluding header)
  full_name?: string;
  success: boolean;
  isDuplicate?: boolean;
  error?: string;
}

interface DemandCapTracker {
  cap: number;
  current: number;
}

interface ResolveContext {
  currentUser: { role: string; userId: string };
  /** email/phone pairs already committed earlier in THIS batch, so two rows in the same
   *  file that duplicate each other are caught even though neither is in the DB yet. */
  seenEmails: Set<string>;
  seenPhones: Set<string>;
  /** Resume-cap running counts per demand id, so many rows targeting the SAME demand in
   *  one batch are checked against the cap cumulatively instead of each re-querying the
   *  DB and all seeing the same (pre-batch) count. */
  demandCapByDemandId: Map<string, DemandCapTracker>;
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Resolves one mapped row (raw strings) into a candidateApiSchema-ready payload plus
 *  an optional linked demand id, or returns a human-readable reason it can't be
 *  imported. Reuses the exact same dedupe rule as POST /api/candidates
 *  (findDuplicateCandidate, normalizeEmail/normalizePhone) and the exact same
 *  demand-link permission/cap rules as POST /api/demands/[requestId]/candidates
 *  (loadDemandContext, canManageDemandPipeline, getResumeCapStatus). */
export async function resolveCandidateImportRow(
  mappedRow: Record<CandidateImportFieldKey, string>,
  ctx: ResolveContext
): Promise<
  | { payload: ReturnType<typeof candidateApiSchema.parse>; demandId: string | null; isTaActor: boolean }
  | { error: string; isDuplicate?: boolean }
> {
  const get = (key: CandidateImportFieldKey) => (mappedRow[key] ?? '').trim();

  const email = get('email');
  const phone = get('phone');
  if (!email) return { error: 'Email is required' };
  if (!phone) return { error: 'Phone is required' };

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (ctx.seenEmails.has(normalizedEmail)) {
    return { error: 'Duplicate email within this file', isDuplicate: true };
  }
  if (ctx.seenPhones.has(normalizedPhone)) {
    return { error: 'Duplicate phone number within this file', isDuplicate: true };
  }

  const duplicate = await findDuplicateCandidate(email, phone);
  if (duplicate) {
    return { error: duplicateCandidateMessage(duplicate), isDuplicate: true };
  }

  // Demand assignment — optional. Same rule as `requestId` on POST /api/candidates:
  // ta/account_manager MUST supply one they're authorized to manage; super_admin may
  // optionally supply one.
  const requestId = get('request_id');
  const isScopedRole = ctx.currentUser.role === 'ta' || ctx.currentUser.role === 'account_manager';
  let demandId: string | null = null;
  if (isScopedRole && !requestId) {
    return {
      error: ctx.currentUser.role === 'ta'
        ? 'Recruiters must import candidates against a demand they are assigned to (Request ID column)'
        : 'Account Managers must import candidates against a demand they own (Request ID column)',
    };
  }
  if (requestId) {
    const demand = await loadDemandContext(requestId);
    if (!demand) return { error: `Request ID "${requestId}" was not found` };
    if (!canManageDemandPipeline({ role: ctx.currentUser.role, id: ctx.currentUser.userId }, demand, demand.recruiterIds)) {
      return {
        error: ctx.currentUser.role === 'ta'
          ? `You are not assigned to demand "${requestId}", so you cannot add a candidate to it`
          : `You do not own demand "${requestId}", so you cannot add a candidate to it`,
      };
    }

    let tracker = ctx.demandCapByDemandId.get(demand.id);
    if (!tracker) {
      const status = await getResumeCapStatus(demand.id, demand.num_positions);
      tracker = { cap: status.cap, current: status.current };
      ctx.demandCapByDemandId.set(demand.id, tracker);
    }
    // Overflow past the active cap is stored as Backup by the submission writer.
    // Counting here only tracks how many of this file's rows are still inside the active slots.
    if (tracker.current < tracker.cap) tracker.current += 1;
    demandId = demand.id;
  }

  const ctcRaw = (value: string) => {
    if (!value) return undefined;
    const num = Number(value);
    return Number.isNaN(num) ? NaN : num;
  };

  const candidatePayload = {
    full_name: get('full_name'),
    email,
    phone,
    alternate_phone: get('alternate_phone') || undefined,
    current_location: get('current_location') || undefined,
    preferred_locations: splitList(get('preferred_locations')),
    current_company: get('current_company') || undefined,
    current_designation: get('current_designation') || undefined,
    total_experience: get('total_experience') || undefined,
    skills: splitList(get('skills')),
    qualification: get('qualification') || undefined,
    specialization: get('specialization') || undefined,
    current_ctc: ctcRaw(get('current_ctc')),
    expected_ctc: ctcRaw(get('expected_ctc')),
    available_from: get('available_from') || undefined,
    availability: get('availability') || 'Immediate',
    work_mode: get('work_mode') || undefined,
    linked_url: get('linked_url') || undefined,
    source: get('source'),
  };

  if (Number.isNaN(candidatePayload.current_ctc)) return { error: 'Current CTC must be a valid number' };
  if (Number.isNaN(candidatePayload.expected_ctc)) return { error: 'Expected CTC must be a valid number' };

  const parsed = candidateApiSchema.safeParse(candidatePayload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation failed' };
  }

  ctx.seenEmails.add(normalizedEmail);
  ctx.seenPhones.add(normalizedPhone);
  if (demandId) {
    const tracker = ctx.demandCapByDemandId.get(demandId)!;
    tracker.current += 1;
  }

  return { payload: parsed.data, demandId, isTaActor: ctx.currentUser.role === 'ta' };
}

/** Maps a raw uploaded row (keyed by original header) to system field keys, per the
 *  user-confirmed column mapping. Unmapped fields come through as ''. */
export function applyMapping(
  rawRow: Record<string, string>,
  mapping: Partial<Record<CandidateImportFieldKey, string>>
): Record<CandidateImportFieldKey, string> {
  const result = {} as Record<CandidateImportFieldKey, string>;
  for (const field of CANDIDATE_IMPORT_FIELDS) {
    const header = mapping[field.key];
    result[field.key] = header ? (rawRow[header] ?? '') : '';
  }
  return result;
}
