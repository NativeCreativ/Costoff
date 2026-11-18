'use client';

import { ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { FormTextArea } from '@/components/ui/FormTextArea';
import { CandidateFileField } from './CandidateFileField';
import { PanField } from './PanField';
import { SkillsSelector } from '@/components/ui/SkillsSelector';
import { LocationMultiSelect } from '@/components/masterData/LocationMultiSelect';
import { useNamedMasterQuery } from '@/queries/masterData/useMasterData';
import { Button } from '@/components/ui/button';
import { candidateSchema } from './candidate.schema';
import { candidateUrgency } from '@/lib/candidates/candidateUrgency';
import { CandidateFormState } from './CandidateFormModal';
import { NOTICE_PERIOD_OPTIONS, CANDIDATE_SOURCE_OPTIONS, WORK_MODE_OPTIONS } from '@/constants/options';

interface CandidateFormProps {
  defaultValues: CandidateFormState;
  onSubmit: (values: CandidateFormState) => void;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel?: string;
  isSubmitting?: boolean;
  idFieldsReadOnlyPlaceholders?: boolean;
  extraContent?: ReactNode;
  /** Edit mode: the saved candidate, so the PAN field can show its last 4 / reveal it. */
  savedCandidate?: { id: string; pan_last4?: string | null } | null;
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-3.5">
      <div className="mb-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">{label}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function CandidateForm({ defaultValues, onSubmit, onCancel, submitLabel, pendingLabel, isSubmitting, idFieldsReadOnlyPlaceholders, extraContent, savedCandidate }: CandidateFormProps) {
  const masterLocations = useNamedMasterQuery('locations');
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CandidateFormState>({
    resolver: zodResolver(candidateSchema),
    defaultValues,
  });

  // The role category lives inside the Key Skills selector but is its own saved field.
  const skillsCategoryId = watch('skills_category_id') ?? '';
  const offerInHand = watch('offer_in_hand') === 'yes';
  const fileSetter = (urlKey: 'resume_url' | 'photo_url' | 'rtr_file_url', nameKey?: 'resume_file_name' | 'rtr_file_name') =>
    ({ url, name }: { url: string; name: string }) => {
      setValue(urlKey, url, { shouldDirty: true });
      if (nameKey) setValue(nameKey, name, { shouldDirty: true });
    };
  const urgency = candidateUrgency({
    offer_in_hand: offerInHand,
    offer_doj: watch('offer_doj') || null,
    availability: watch('availability'),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-[10px] bg-[#f8fafc] p-3.5">
      {extraContent}

      <SectionCard label="Basic Information">
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Full Name" required placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. Ankit Verma' : undefined} hint="As per Aadhaar / PAN" register={register('full_name')} error={errors.full_name?.message} />
          <FormField label="Date of Birth" type="date" register={register('date_of_birth')} error={errors.date_of_birth?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Email" required type="email" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. ankit@gmail.com' : undefined} register={register('email')} error={errors.email?.message} />
          <FormField label="Alternate Email" type="email" placeholder="Optional" register={register('alternate_email')} error={errors.alternate_email?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Mobile Number" required placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. +91 9876543210' : undefined} register={register('phone')} error={errors.phone?.message} />
          <FormField label="Alternate Contact Number" placeholder={idFieldsReadOnlyPlaceholders ? 'Optional' : undefined} register={register('alternate_phone')} error={errors.alternate_phone?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <PanField register={register('pan')} error={errors.pan?.message} savedCandidate={savedCandidate} />
          <CandidateFileField kind="photo" label="Photo (passport size)" url={watch('photo_url') ?? ''} name="" onChange={fileSetter('photo_url')} />
        </div>
      </SectionCard>

      <SectionCard label="Location">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Both pick from the Locations master (review, Nov 2026). Current Location suggests
              master values but still accepts older free-text entries already saved. */}
          <div>
            <FormField label="Current Location" placeholder="Start typing to pick a location" listId="candidate-master-locations" register={register('current_location')} error={errors.current_location?.message} />
            <datalist id="candidate-master-locations">
              {(masterLocations.data ?? []).map((location) => <option key={location.id} value={location.name} />)}
            </datalist>
          </div>
          <Controller
            name="preferred_locations"
            control={control}
            render={({ field }) => (
              <div>
                <LocationMultiSelect label="Preferred Location" value={field.value} onChange={field.onChange} />
                {errors.preferred_locations?.message && <p className="mt-1 text-[0.72rem] text-[#dc2626]">{errors.preferred_locations.message}</p>}
              </div>
            )}
          />
        </div>
      </SectionCard>

      <SectionCard label="Professional Information">
        <div className="grid grid-cols-3 gap-2.5">
          <FormField label="Current Company" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. TCS / Infosys' : undefined} register={register('current_company')} error={errors.current_company?.message} />
          <FormField label="Current Designation" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. Senior Developer' : undefined} register={register('current_designation')} error={errors.current_designation?.message} />
          <FormField label="Total Experience" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. 3-5 Years' : undefined} register={register('total_experience')} error={errors.total_experience?.message} />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <FormField label="Relevant Experience" placeholder="e.g. 4 years in Java" register={register('relevant_experience')} error={errors.relevant_experience?.message} />
          <FormField label="Employee ID" placeholder="At the current company" register={register('employee_id')} error={errors.employee_id?.message} />
          <FormField label="Duration in Current Role" placeholder="e.g. 2 years 3 months" register={register('duration_in_role')} error={errors.duration_in_role?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Core Specialization" placeholder="e.g. Payments backend" register={register('core_specialization')} error={errors.core_specialization?.message} />
          <FormField label="Reason for Change" placeholder="Why they want to move" register={register('reason_for_change')} error={errors.reason_for_change?.message} />
        </div>
        <div>
          <Controller
            name="skills"
            control={control}
            render={({ field }) => (
              <SkillsSelector
                label="Skill Group"
                value={field.value}
                onChange={field.onChange}
                error={errors.skills?.message}
                categoryId={skillsCategoryId}
                onCategoryChange={(id) => setValue('skills_category_id', id, { shouldDirty: true })}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Qualification" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. B.Tech' : undefined} register={register('qualification')} error={errors.qualification?.message} />
          <FormField label="Specialization" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. Computer Science' : undefined} register={register('specialization')} error={errors.specialization?.message} />
        </div>
      </SectionCard>

      <SectionCard label="Compensation, Availability & Preference">
        <div className="grid grid-cols-3 gap-2.5">
          <FormField label="Current CTC" type="number" maxDigits={10} placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. 1200000' : undefined} register={register('current_ctc')} error={errors.current_ctc?.message} />
          <FormField label="Expected CTC" type="number" maxDigits={10} placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. 1600000' : undefined} register={register('expected_ctc')} error={errors.expected_ctc?.message} />
          <FormField label="Available From" type="date" register={register('available_from')} error={errors.available_from?.message} />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Controller
            name="availability"
            control={control}
            render={({ field }) => (
              <FormSelect label="Notice Period" required options={NOTICE_PERIOD_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="work_mode"
            control={control}
            render={({ field }) => (
              <FormSelect label="Work Mode" options={WORK_MODE_OPTIONS} value={field.value} onChange={field.onChange} allowClear placeholder="Select work mode (optional)" />
            )}
          />
          <FormField label="Last Working Day (LWD)" type="date" register={register('last_working_day')} error={errors.last_working_day?.message} />
        </div>
        {/* Offer in hand + notice period drive the Urgent badge (candidateUrgency). */}
        <div className="grid grid-cols-4 gap-2.5">
          <Controller
            name="offer_in_hand"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Offer in Hand"
                options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {offerInHand && (
            <>
              <FormField label="Offer Company" placeholder="e.g. Accenture" register={register('offer_company')} error={errors.offer_company?.message} />
              <FormField label="Offer CTC" type="number" maxDigits={10} placeholder="e.g. 1500000" register={register('offer_ctc')} error={errors.offer_ctc?.message} />
              <FormField label="Offer Date of Joining" type="date" register={register('offer_doj')} error={errors.offer_doj?.message} />
            </>
          )}
        </div>
        {urgency && (
          <div
            className={`rounded-md border px-3 py-1.5 text-[0.76rem] ${
              urgency.level === 'high' ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]' : 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]'
            }`}
          >
            <strong>{urgency.label}:</strong> {urgency.reason}
          </div>
        )}
      </SectionCard>

      <SectionCard label="Profile / Source">
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Linked URL" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. linkedin.com/in/ankit' : undefined} register={register('linked_url')} error={errors.linked_url?.message} />
          <Controller
            name="source"
            control={control}
            render={({ field }) => (
              <FormSelect label="Source" required options={CANDIDATE_SOURCE_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
        <CandidateFileField kind="resume" label="Resume" url={watch('resume_url') ?? ''} name={watch('resume_file_name') ?? ''} onChange={fileSetter('resume_url', 'resume_file_name')} />
        <div className="flex flex-col gap-2 rounded-md border border-[#e2e8f0] bg-white p-2.5">
          <label className="flex items-center gap-2 text-[0.82rem] font-semibold text-[#334155]">
            <input type="checkbox" {...register('rtr_acknowledged')} />
            RTR / acknowledgment received from the candidate
          </label>
          <FormField label="RTR note" placeholder="e.g. Acknowledged by email on 12 Nov" register={register('rtr_note')} error={errors.rtr_note?.message} />
          <CandidateFileField kind="rtr" label="RTR / acknowledgment file" url={watch('rtr_file_url') ?? ''} name={watch('rtr_file_name') ?? ''} onChange={fileSetter('rtr_file_url', 'rtr_file_name')} />
        </div>
      </SectionCard>

      <SectionCard label="Other Details">
        <FormTextArea
          label="Other Details"
          rows={3}
          placeholder={'Anything not covered above, one per line as "Label: value" (e.g. Passport: Yes)'}
          register={register('other_details')}
          error={errors.other_details?.message}
        />
      </SectionCard>

      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-auto rounded-md border-[#e2e8f0] bg-white px-4 py-2 font-normal">Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="h-auto rounded-md px-4 py-2 font-semibold">{isSubmitting ? (pendingLabel ?? submitLabel) : submitLabel}</Button>
      </div>
    </form>
  );
}
