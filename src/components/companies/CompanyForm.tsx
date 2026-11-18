'use client';

import { ReactNode, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Globe, MapPin, Phone, Save } from 'lucide-react';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { Button } from '@/components/ui/button';
import { InterviewRoundConfigurator, roundIdentity } from '@/components/interviewRounds/InterviewRoundConfigurator';
import { companyFormSchema } from './company.schema';
import { COMPANY_STATUS_OPTIONS } from '@/constants/options';
import { SpocListEditor } from '@/components/masterData/SpocListEditor';
import type { ClientSpocItem } from '@/components/masterData/spoc.schema';
import type { ConfiguredRound } from '@/services/interviewRound.service';

/** Form values: the company's own fields. `status` is the schema's enum so zodResolver's types line up. */
export type CompanyFormValues = {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  status: 'ACTIVE' | 'INACTIVE';
  spocs: ClientSpocItem[];
};

/** Exposed methods for parent components (e.g., the Add Demand drawer). */
export interface CompanyFormHandle {
  /** Reset the form to its initial defaultValues. */
  reset: () => void;
  /** Check if the form is currently dirty (user has made changes). */
  isDirty: () => boolean;
}

interface CompanyFormProps {
  defaultValues: CompanyFormValues;
  /** The company's currently-configured rounds; pre-filled on edit, empty on create. */
  initialRounds?: ConfiguredRound[];
  onSubmit: (values: CompanyFormValues, rounds: ConfiguredRound[]) => void;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel?: string;
  isSubmitting?: boolean;
  /** True when the actor may not edit (read-only viewer of the Company module). */
  readOnly?: boolean;
  /** Called when client-side validation blocks the submit, with a human-readable reason. */
  onValidationError?: (message: string) => void;
  /** Set so an external button can submit this form via the HTML `form="<id>"` attribute —
   *  used by the Add Demand drawer, which renders its own fixed Save button outside this
   *  component instead of the built-in action row below (see `hideActions`). */
  formId?: string;
  /** Hides the built-in Cancel/Save row — for a caller (the Add Demand drawer) that renders its
   *  own fixed footer and submits via `formId` instead. Clients Master never sets this, so its
   *  layout is unchanged. */
  hideActions?: boolean;
  /** Reports whether the user has entered anything (any field dirty, or a round added) —
   *  for a caller that needs to confirm before discarding (the Add Demand drawer). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Whether to show the Interview Rounds section. Defaults to true (Clients Master behavior). */
  showRounds?: boolean;
}

/** Section wrapper matching DemandForm's SectionCard so the two forms read identically. */
function SectionCard({ label, icon, hint, children }: { label: string; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-[#2563eb]">{icon}</span>}
        <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">{label}</span>
      </div>
      {hint && <p className="mb-3 text-[0.78rem] leading-relaxed text-[#94a3b8]">{hint}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

const CompanyForm = forwardRef<CompanyFormHandle, CompanyFormProps>(({
  defaultValues,
  initialRounds,
  onSubmit,
  onCancel,
  submitLabel,
  pendingLabel,
  isSubmitting,
  readOnly,
  onValidationError,
  formId,
  hideActions,
  onDirtyChange,
  showRounds = true,
}, ref) => {
  const [rounds, setRounds] = useState<ConfiguredRound[]>(initialRounds ?? []);

  const { register, control, handleSubmit, formState: { errors, isDirty }, reset } = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues,
  });

  // Expose form methods to parent
  useImperativeHandle(ref, () => ({
    reset: () => {
      reset(defaultValues);
      setRounds(initialRounds ?? []);
    },
    isDirty: () => isDirty || rounds.length > 0,
  }));

  // Rounds are a plain useState, not part of react-hook-form's own dirty tracking, so "has the
  // user entered anything" has to combine both.
  useEffect(() => {
    onDirtyChange?.(isDirty || rounds.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, rounds]);

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(
        (values) => onSubmit(values, rounds),
        // Second arg of handleSubmit runs ONLY when validation fails. Without it, a schema
        // mismatch simply blocks the submit and the user sees nothing happen — which is exactly
        // how the earlier status-enum bug presented. This surfaces the real reason.
        (validationErrors) => {
          const first = Object.values(validationErrors)[0];
          const message =
            first && 'message' in first && typeof first.message === 'string'
              ? first.message
              : 'Please correct the highlighted fields and try again.';
          onValidationError?.(message);
        }
      )}
      className="flex flex-col gap-3.5"
      noValidate
    >
      <SectionCard
        label="Client"
        icon={<Building2 className="h-4 w-4" />}
        hint="Client Name is the unique key for this record. Matching ignores case and extra spaces, so an existing client is reused rather than duplicated."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Client Name"
            required
            placeholder="e.g. Acme Corp Pvt Ltd"
            register={register('name')}
            error={errors.name?.message}
            disabled={readOnly}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Status"
                options={COMPANY_STATUS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.status?.message}
                disabled={readOnly}
              />
            )}
          />
        </div>
      </SectionCard>

      <SectionCard label="Contact Details" icon={<Phone className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Email"
            type="email"
            placeholder="e.g. hr@acme.com"
            register={register('email')}
            error={errors.email?.message}
            disabled={readOnly}
          />
          <FormField
            label="Phone"
            placeholder="e.g. +91 98765 43210"
            register={register('phone')}
            error={errors.phone?.message}
            disabled={readOnly}
          />
        </div>
        <FormField
          label="Website"
          placeholder="e.g. https://acme.com"
          register={register('website')}
          error={errors.website?.message}
          disabled={readOnly}
        />
      </SectionCard>

      <SectionCard label="Client SPOCs" icon={<Phone className="h-4 w-4" />} hint="People at the client. This list is separate from the internal Account Manager on a demand.">
        <Controller
          name="spocs"
          control={control}
          render={({ field }) => (
            <SpocListEditor
              variant="client"
              value={field.value ?? []}
              onChange={field.onChange}
              disabled={readOnly}
              error={errors.spocs?.message as string | undefined}
            />
          )}
        />
      </SectionCard>

      <SectionCard label="Location" icon={<MapPin className="h-4 w-4" />}>
        <FormField
          label="Address"
          placeholder="Street address"
          register={register('address')}
          error={errors.address?.message}
          disabled={readOnly}
        />
        <div className="grid grid-cols-3 gap-3">
          <FormField label="City" placeholder="e.g. Bengaluru" register={register('city')} error={errors.city?.message} disabled={readOnly} />
          <FormField label="State" placeholder="e.g. Karnataka" register={register('state')} error={errors.state?.message} disabled={readOnly} />
          <FormField label="Country" placeholder="e.g. India" register={register('country')} error={errors.country?.message} disabled={readOnly} />
        </div>
      </SectionCard>

      {showRounds && (
        <SectionCard
          label="Interview Template"
          icon={<Globe className="h-4 w-4" />}
          hint={readOnly ? undefined : "Optional. Rounds in use can't be edited or deleted. Set them inactive to hide them from new demands."}
        >
          <InterviewRoundConfigurator
            variant="company"
            rounds={rounds}
            onChange={setRounds}
            disabled={readOnly}
            usageCount={(key) => rounds.find((r) => roundIdentity(r) === key)?.usage}
            lockedInfo={(key) => {
              const usage = rounds.find((r) => roundIdentity(r) === key)?.usage;
              if (!usage) return undefined;
              return { locked: true, message: `In use by ${usage} demand${usage === 1 ? '' : 's'}/interview${usage === 1 ? '' : 's'} and cannot be edited or deleted.` };
            }}
            onToggleRound={(round) =>
              setRounds(rounds.map((r) => (roundIdentity(r) === roundIdentity(round) ? { ...r, isActive: r.isActive === false } : r)))
            }
          />
        </SectionCard>
      )}

      {!hideActions && (
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              <Save className="h-4 w-4" />
              {isSubmitting ? pendingLabel || 'Saving…' : submitLabel}
            </Button>
          )}
        </div>
      )}
    </form>
  );
});

CompanyForm.displayName = 'CompanyForm';

export { CompanyForm };