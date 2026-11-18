import type { CandidateApiValues } from '@/components/candidates/candidate.schema';
import { encryptPan, normalizePan } from './panCrypto';

/**
 * Review batch 2 (Nov 2026) candidate fields, mapped from the API body to DB columns. Shared by
 * POST and PUT /api/candidates. Only keys present in the body are returned, so a PUT that does
 * not send a field leaves it unchanged. `pan` is special: absent or '' keeps the saved PAN.
 */
export function candidateProfileFieldData(values: Partial<CandidateApiValues>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const text = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const date = (v: string | null | undefined) => (v ? new Date(v) : null);

  if (values.alternate_email !== undefined) out.alternate_email = text(values.alternate_email)?.toLowerCase() ?? null;
  if (values.relevant_experience !== undefined) out.relevant_experience = text(values.relevant_experience);
  if (values.pan) {
    const pan = normalizePan(values.pan);
    Object.assign(out, encryptPan(pan));
  }
  if (values.date_of_birth !== undefined) out.date_of_birth = date(values.date_of_birth);
  if (values.rtr_acknowledged !== undefined) out.rtr_acknowledged = values.rtr_acknowledged;
  if (values.rtr_note !== undefined) out.rtr_note = text(values.rtr_note);
  if (values.rtr_file_url !== undefined) {
    out.rtr_file_url = text(values.rtr_file_url);
    out.rtr_file_name = out.rtr_file_url ? text(values.rtr_file_name) : null;
  }
  if (values.photo_url !== undefined) out.photo_url = text(values.photo_url);
  if (values.resume_url !== undefined) {
    out.resume_url = text(values.resume_url);
    out.resume_file_name = out.resume_url ? text(values.resume_file_name) : null;
  }
  if (values.employee_id !== undefined) out.employee_id = text(values.employee_id);
  if (values.core_specialization !== undefined) out.core_specialization = text(values.core_specialization);
  if (values.duration_in_role !== undefined) out.duration_in_role = text(values.duration_in_role);
  if (values.reason_for_change !== undefined) out.reason_for_change = text(values.reason_for_change);
  if (values.last_working_day !== undefined) out.last_working_day = date(values.last_working_day);
  if (values.other_details !== undefined) out.other_details = text(values.other_details);
  return out;
}
