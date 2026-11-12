'use client';

import { ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { TagInput } from '@/components/ui/TagInput';
import { SkillsSelector } from '@/components/ui/SkillsSelector';
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
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-3.5">
      <div className="mb-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">{label}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function CandidateForm({ defaultValues, onSubmit, onCancel, submitLabel, pendingLabel, isSubmitting, idFieldsReadOnlyPlaceholders, extraContent }: CandidateFormProps) {
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CandidateFormState>({
    resolver: zodResolver(candidateSchema),
    defaultValues,
  });

  // The role category lives inside the Key Skills selector but is its own saved field.
  const skillsCategoryId = watch('skills_category_id') ?? '';
  const offerInHand = watch('offer_in_hand') === 'yes';
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
          <FormField label="Full Name" required placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. Ankit Verma' : undefined} register={register('full_name')} error={errors.full_name?.message} />
          <FormField label="Email" required type="email" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. ankit@gmail.com' : undefined} register={register('email')} error={errors.email?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Phone Number" required placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. +91 9876543210' : undefined} register={register('phone')} error={errors.phone?.message} />
          <FormField label="Alternate Phone Number" placeholder={idFieldsReadOnlyPlaceholders ? 'Optional' : undefined} register={register('alternate_phone')} error={errors.alternate_phone?.message} />
        </div>
      </SectionCard>

      <SectionCard label="Location">
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Current Location" placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. Bangalore' : undefined} register={register('current_location')} error={errors.current_location?.message} />
          <Controller
            name="preferred_locations"
            control={control}
            render={({ field }) => (
              <TagInput label="Preferred Location" placeholder="Type a location and press Enter" value={field.value} onChange={field.onChange} error={errors.preferred_locations?.message} />
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
        <div>
          <Controller
            name="skills"
            control={control}
            render={({ field }) => (
              <SkillsSelector
                label="Key Skills"
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
      </SectionCard>

      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-auto rounded-md border-[#e2e8f0] bg-white px-4 py-2 font-normal">Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="h-auto rounded-md px-4 py-2 font-semibold">{isSubmitting ? (pendingLabel ?? submitLabel) : submitLabel}</Button>
      </div>
    </form>
  );
}
