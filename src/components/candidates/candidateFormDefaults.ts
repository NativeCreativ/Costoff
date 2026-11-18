import { matchEnumOptionLoosely, NOTICE_PERIOD_VALUES, type CandidateFormValues } from './candidate.schema';
import { DEMAND_WORK_MODE_VALUES } from '@/components/demands/demand.schema';
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

/** A saved candidate as Candidate-form values (Edit Candidate, Demand Match follow-up). */
export function candidateToFormState(c: Candidate): CandidateFormValues {
  return {
    full_name: c.full_name || '',
    email: c.email || '',
    phone: c.phone || '',
    alternate_phone: c.alternate_phone || '',
    current_location: c.current_location || '',
    preferred_locations: Array.isArray(c.preferred_locations) ? c.preferred_locations : [],
    current_company: c.current_company || '',
    current_designation: c.current_designation || '',
    total_experience: c.total_experience || '',
    skills: Array.isArray(c.skills) ? c.skills : [],
    // Blank when no category was ever picked, or when it was deleted/deactivated since.
    skills_category_id: c.skills_category_id || '',
    qualification: c.qualification || '',
    specialization: c.specialization || '',
    current_ctc: c.current_ctc ? c.current_ctc.toString() : '',
    expected_ctc: c.expected_ctc ? c.expected_ctc.toString() : '',
    available_from: c.available_from ? c.available_from.slice(0, 10) : '',
    availability: (matchEnumOptionLoosely(c.availability, NOTICE_PERIOD_VALUES) || 'Immediate') as CandidateFormValues['availability'],
    work_mode: matchEnumOptionLoosely(c.work_mode, DEMAND_WORK_MODE_VALUES),
    linked_url: c.linked_url || '',
    source: (c.source || 'naukri') as CandidateFormValues['source'],
    offer_in_hand: c.offer_in_hand ? 'yes' : 'no',
    offer_company: c.offer_company || '',
    offer_ctc: c.offer_ctc ? c.offer_ctc.toString() : '',
    offer_doj: c.offer_doj ? c.offer_doj.slice(0, 10) : '',
    ...candidateProfileFormFields(c),
  };
}

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
