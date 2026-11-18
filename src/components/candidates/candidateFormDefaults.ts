import type { CandidateFormValues } from './candidate.schema';
import type { Candidate } from '@/components/types';

type ProfileFieldKeys =
  | 'alternate_email' | 'relevant_experience' | 'pan' | 'date_of_birth' | 'rtr_acknowledged' | 'rtr_note'
  | 'rtr_file_url' | 'rtr_file_name' | 'photo_url' | 'resume_url' | 'resume_file_name' | 'employee_id'
  | 'core_specialization' | 'duration_in_role' | 'reason_for_change' | 'last_working_day' | 'other_details';

/** Review batch 2 fields for an empty Add Candidate form. Spread into every empty form. */
export const EMPTY_CANDIDATE_PROFILE_FIELDS: Pick<CandidateFormValues, ProfileFieldKeys> = {
  alternate_email: '',
  relevant_experience: '',
  pan: '',
  date_of_birth: '',
  rtr_acknowledged: false,
  rtr_note: '',
  rtr_file_url: '',
  rtr_file_name: '',
  photo_url: '',
  resume_url: '',
  resume_file_name: '',
  employee_id: '',
  core_specialization: '',
  duration_in_role: '',
  reason_for_change: '',
  last_working_day: '',
  other_details: '',
};

/** The same fields from a saved candidate, for the Edit form. The PAN is never prefilled. */
export function candidateProfileFormFields(c: Candidate): Pick<CandidateFormValues, ProfileFieldKeys> {
  const day = (v?: string | null) => (v ? v.slice(0, 10) : '');
  return {
    alternate_email: c.alternate_email || '',
    relevant_experience: c.relevant_experience || '',
    pan: '',
    date_of_birth: day(c.date_of_birth),
    rtr_acknowledged: !!c.rtr_acknowledged,
    rtr_note: c.rtr_note || '',
    rtr_file_url: c.rtr_file_url || '',
    rtr_file_name: c.rtr_file_name || '',
    photo_url: c.photo_url || '',
    resume_url: c.resume_url || '',
    resume_file_name: c.resume_file_name || '',
    employee_id: c.employee_id || '',
    core_specialization: c.core_specialization || '',
    duration_in_role: c.duration_in_role || '',
    reason_for_change: c.reason_for_change || '',
    last_working_day: day(c.last_working_day),
    other_details: c.other_details || '',
  };
}
