'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { FormTextArea } from '@/components/ui/FormTextArea';
import { TagInput } from '@/components/ui/TagInput';
import { SkillsSelector } from '@/components/ui/SkillsSelector';
import { UserSelect } from '@/components/ui/UserSelect';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { demandSchema, DEMAND_WORK_MODE_VALUES } from './demand.schema';
import { DemandFormState } from './DemandFormModal';
import { CustomerJdField } from './CustomerJdField';
import { ClientSpocField } from './ClientSpocField';
import { CertificationsEditor } from './CertificationsEditor';
import { cn } from '@/lib/utils';
import { CompanySelect } from '@/components/companies/CompanySelect';
import { getCompany } from '@/services/company.service';
import { InterviewRoundConfigurator } from '@/components/interviewRounds/InterviewRoundConfigurator';
import { useDemandInterviewRounds } from '@/hooks/useDemandInterviewRounds';
import { useDemandInterviewConfigQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { canManageInterviewConfig } from '@/lib/auth/demandFulfillmentPermissions';
import { canEditDemand } from '@/lib/auth/demandPermissions';
import type { Demand } from '@/components/types';
import { PRIORITY_OPTIONS, DEMAND_STATUS_OPTIONS } from '@/constants/options';
import { useDemandTypeSkillGroupsQuery, useNamedMasterQuery } from '@/queries/masterData/useMasterData';
import { useActiveEndClientsQuery } from '@/queries/endClients/useEndClients';
import { LocationMultiSelect } from '@/components/masterData/LocationMultiSelect';
import { useAmProfilesQuery } from '@/queries/demands/useAmProfilesQuery';
import { useDemandRequestIdAvailabilityQuery } from '@/queries/demands/useDemandRequestIdAvailabilityQuery';
import { useDebounce } from '@/hooks/useDebounce';
import {
  DEMAND_REQUEST_ID_HINT,
  duplicateDemandRequestIdMessage,
  normalizeDemandRequestId,
  sanitizeDemandRequestIdInput,
  validateDemandRequestId,
} from '@/lib/demands/demandRequestIdRules';
import { useSpocProfilesQuery } from '@/queries/demands/useSpocProfilesQuery';
import { useRecruiterProfilesQuery } from '@/queries/demands/useRecruiterProfilesQuery';
import { useCompensationCurrenciesQuery, useCompensationTypesQuery } from '@/queries/settings/useCompensationMastersQueries';

interface DemandFormProps {
  defaultValues: DemandFormState;
  onSubmit: (values: DemandFormState) => void;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel?: string;
  isSubmitting?: boolean;
  idFieldsReadOnlyPlaceholders?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  /** Edit mode only: labels for the already-assigned AM/SPOC/Recruiters, known from the
   *  demand being edited — shown immediately instead of waiting for the AM/SPOC/Recruiter
   *  profile-list queries to resolve (those can be slow, and until they do, these selects
   *  would otherwise render as empty/placeholder even though a value is already set). */
  initialAmLabel?: string;
  initialSpocLabel?: string;
  initialRecruiterOptions?: { id: string; name: string }[];
  /** Edit mode: the demand being edited, so the form can read its explicit interview-round
   *  configuration (which must never be overwritten by the Company default) and its company label. */
  editingDemand?: Demand | null;
  /** Create mode: display name of the company already chosen (e.g. pre-selected from a clone). */
  initialCompanyLabel?: string;
  /** Create mode only: callback when the user clicks "+ Add Client" to open the full drawer. */
  onQuickCreate?: () => void;
  clientLockedByDrawer?: boolean;
  /** The demand's current interview rounds (for prefill in the drawer) */
  demandRounds?: { round_id?: string | null; name: string; mode?: string | null; order: number; mandatory?: boolean }[];
  /** The demand's current SPOC id (for prefill in the drawer) */
  demandSpocId?: string;
  /** The demand's current Account Manager id (for prefill in the Add Client drawer) */
  demandAccountManagerId?: string;
  /** When true, the next auto-selection of a company (e.g. from the Add Client drawer) must not
   *  re-seed interview rounds -- newly-created clients are round-less and their selection must
   *  not clear rounds the user already typed. */
  preserveRoundsOnNextCompanyChange?: boolean;
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-3.5">
      <div className="mb-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">{label}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function DemandForm({ defaultValues, onSubmit, onCancel, submitLabel, pendingLabel, isSubmitting, idFieldsReadOnlyPlaceholders, currentUserId, currentUserRole, initialAmLabel, initialSpocLabel, initialRecruiterOptions, editingDemand, initialCompanyLabel, onQuickCreate, clientLockedByDrawer, demandRounds = [], demandSpocId, preserveRoundsOnNextCompanyChange }: DemandFormProps) {
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<DemandFormState>({
    resolver: zodResolver(demandSchema),
    defaultValues,
  });

  // Sync external updates to company_id (e.g. when a client is auto-selected after being created
  // from the "Add Client" drawer). React Hook Form only reads `defaultValues` on mount, so
  // external changes to the prop must be pushed in explicitly.
  useEffect(() => {
    if (defaultValues.company_id && defaultValues.company_id !== (watch('company_id') || '')) {
      setValue('company_id', defaultValues.company_id, { shouldValidate: true, shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues.company_id]);
  const isCreateMode = !!idFieldsReadOnlyPlaceholders;
  const isAccountManagerActor = currentUserRole === 'account_manager';
  const isSuperAdminActor = currentUserRole === 'super_admin';
  // AM sees and can set the AM field in create mode (auto-filled to self), but it's locked.
  // Super admin always sees and can change it.
  const showAmSelector = isSuperAdminActor || (isAccountManagerActor && isCreateMode);
  // Lock the AM selector for AM role (auto-set to self), but let super_admin change it.
  const amSelectorDisabled = isAccountManagerActor;

  // The role category lives inside the Required Skills selector but is its own saved field.
  const skillsCategoryId = watch('skills_category_id') ?? '';
  const roleCategory = watch('role_category');
  const demandType = watch('demand_type');
  const endClientId = watch('end_client_id');
  const categoriesQuery = useNamedMasterQuery('demand-categories');
  const demandTypesQuery = useNamedMasterQuery('demand-types');
  const endClientsQuery = useActiveEndClientsQuery();
  const withCurrent = (options: { value: string; label: string }[], current: string) =>
    current && !options.some((option) => option.value === current)
      ? [{ value: current, label: current }, ...options]
      : options;
  const categoryOptions = withCurrent(
    (categoriesQuery.data ?? []).map((row) => ({ value: row.name, label: row.name })),
    roleCategory
  );
  const demandTypeOptions = withCurrent(
    (demandTypesQuery.data ?? []).map((row) => ({ value: row.name, label: row.name })),
    demandType
  );
  // Demand Type → Skill Groups (Master Data → Demand Type). Demands store the type by name.
  const demandTypeSkillGroupsQuery = useDemandTypeSkillGroupsQuery();
  const suggestedSkillGroupIds =
    (demandTypeSkillGroupsQuery.data ?? []).find((link) => link.demand_type_name === demandType)?.skill_category_ids ?? [];
  const endClientOptions = (() => {
    const options = (endClientsQuery.data?.data ?? []).map((row) => ({ value: row.id, label: row.name }));
    if (endClientId && !options.some((option) => option.value === endClientId)) {
      return [{ value: endClientId, label: editingDemand?.end_client_name || endClientId }, ...options];
    }
    return options;
  })();

  // ── Request ID: uppercased input, inline duplicate check ─────────────────────
  // The saved ID of the demand being edited: the form must never judge it, or a legacy ID
  // that predates today's rules would block an edit.
  const initialRequestId = normalizeDemandRequestId(defaultValues.request_id ?? '');
  const enteredRequestId = watch('request_id') ?? '';
  const debouncedRequestId = useDebounce(enteredRequestId, 400);
  const requestIdAvailability = useDemandRequestIdAvailabilityQuery(debouncedRequestId, {
    enabled: isCreateMode,
  });
  // The field's own validator owns format/length/reserved; the probe only adds "already exists".
  const duplicateError =
    isCreateMode && requestIdAvailability.data === false && debouncedRequestId.trim() !== ''
      ? duplicateDemandRequestIdMessage(normalizeDemandRequestId(debouncedRequestId))
      : undefined;
  const requestIdError = errors.request_id?.message || duplicateError;

  // ── Interview rounds: demand config wins, else inherit from the selected Company ──
  const selectedCompanyId = watch('company_id') || null;
  // Client SPOCs belong to one client: switching client (Add Demand only — the client is fixed
  // on edit) drops the previous client's picks rather than sending ids the API would reject.
  const previousCompanyIdRef = useRef(selectedCompanyId);
  useEffect(() => {
    if (previousCompanyIdRef.current && previousCompanyIdRef.current !== selectedCompanyId) {
      setValue('client_spoc_ids', [], { shouldDirty: true });
    }
    previousCompanyIdRef.current = selectedCompanyId;
  }, [selectedCompanyId, setValue]);
  const configQuery = useDemandInterviewConfigQuery(editingDemand?.request_id || null);
  const toast = useToast();
  const {
    rounds: interviewRounds,
    setRounds: setInterviewRounds,
    source: roundsSource,
    isLoading: companyRoundsLoading,
    isError: companyRoundsErrored,
  } = useDemandInterviewRounds({
    companyId: selectedCompanyId,
    demandRounds: (configQuery.data?.rounds ?? []).map((r) => ({
      round_id: r.master_round_id ?? r.id,
      row_id: r.id,
      name: r.name,
      mode: r.mode,
      order: r.round_order,
      mandatory: r.mandatory,
    })),
    demandHasConfig: !!configQuery.data?.hasOverride,
    preserveRoundsOnNextChange: preserveRoundsOnNextCompanyChange,
    confirmReplace: () =>
      window.confirm('You already edited the interview rounds list. Changing the Company will replace it with the new Company’s rounds. Continue?'),
  });
  const canEditInterviewRounds =
    currentUserRole === 'super_admin' || (!!editingDemand && canManageInterviewConfig({ role: currentUserRole, id: currentUserId }, editingDemand));
  const hasOwnSavedRounds = configQuery.data?.hasOverride;
  const isEditScenarioA = !isCreateMode && hasOwnSavedRounds === true; // has its own saved rounds
  const isEditScenarioB = !isCreateMode && hasOwnSavedRounds === false; // no rounds saved yet
  const isLoadingOwnRounds = !isCreateMode && configQuery.isLoading;


  const selectedCompanyQuery = useQuery({
    queryKey: ['company-label', selectedCompanyId],
    queryFn: () => getCompany(selectedCompanyId as string),
    enabled: isCreateMode && !!selectedCompanyId,
    staleTime: 60 * 1000,
  });
  const selectedCompanyLabel = selectedCompanyQuery.data?.client_name || selectedCompanyQuery.data?.name;
  // Edit form: the demand already carries its company's mirrored display name — no extra fetch.
  

  // Couldn't load the company's rounds — toast once per failed fetch, then rely on the hook's
  // own fallback (an empty list the user can still type into) so demand creation is never
  // blocked. Create mode only; the Edit form never fetches company rounds at all (see scenario
  // A/B above).
  const toastedErrorForCompany = useRef<string | null>(null);
  useEffect(() => {
    if (!isCreateMode || !companyRoundsErrored || !selectedCompanyId) return;
    if (toastedErrorForCompany.current === selectedCompanyId) return;
    toastedErrorForCompany.current = selectedCompanyId;
    toast.error("Couldn't load this company's saved interview rounds — using defaults instead.");
  }, [isCreateMode, companyRoundsErrored, selectedCompanyId, toast]);

  // Describes where the on-screen list came from AND what saving it will do to the company.
  // The company is only ever written by the backend's first-time seed (a company with zero
  // rounds), so these labels state the outcome rather than promising a sync.
  const roundsSourceLabel = isCreateMode
    ? roundsSource === 'company'
      ? `Loaded from the saved interview rounds of ${selectedCompanyLabel || 'this company'}. Changes here apply to this demand only.`
      : selectedCompanyId
      ? `${selectedCompanyLabel || 'This company'} has no saved rounds yet — add your own below. Saving seeds them as the company's rounds.`
      : 'Pick a client to load its saved rounds.'
    : isEditScenarioA
    ? 'Rounds saved for this demand. Changes apply to this demand only — they never change the company’s rounds.'
    : isEditScenarioB
    ? 'No rounds saved for this demand yet. Add your own below — changes apply to this demand only.'
    : '';

  // In-use lock for an EXISTING demand's own rounds: a round that already has interviews for THIS
  // demand cannot be deleted or renamed (adding / Mandatory / reorder stay open). Keyed the same
  // way the backend matches — by the materialized row id, falling back to the master id for a
  // round that predates it — so the icons the form mutes are exactly the rows the save would
  // reject. A hint only: the save re-checks inside its own transaction.
  const roundInterviewCounts = new Map(
    (configQuery.data?.rounds ?? []).flatMap((r) => [
      [r.id, r.interviews_count ?? 0] as [string, number],
      ...(r.master_round_id ? ([[r.master_round_id, r.interviews_count ?? 0]] as [string, number][]) : []),
    ])
  );

  // Edit mode: the demand's own saved rounds as originally loaded (empty for Scenario B,
  // never the inherited company/global fallback) — what "changed" is compared against before
  // sending interview_rounds at all, per the save/sync rules.
  const initialOwnRounds = isEditScenarioA ? configQuery.data?.rounds ?? [] : [];
  const normalizeRoundsForCompare = (list: { name: string; mode?: string | null; mandatory?: boolean }[]) =>
    list.map((r) => `${r.name.trim().toLowerCase()}:${r.mode?.trim().toLowerCase() || ''}:${!!r.mandatory}`).join('|');

  /** Serializes the editor's list into the hidden field's value. `row_id` is always present —
   *  `null` for a round that does not exist in the DB yet — so the backend can tell a delete
   *  from a rename, and a delete-then-re-add under the same name, without matching on names. */
  const toRoundsFieldValue = (
    list: { round_id?: string | null; row_id?: string | null; name: string; mode?: string | null; order: number; mandatory?: boolean }[]
  ) =>
    JSON.stringify(
      list.map((r) => ({
        round_id: r.round_id ?? null,
        row_id: r.row_id ?? null,
        name: r.name,
        mode: r.mode?.trim() || null,
        order: r.order,
        mandatory: !!r.mandatory,
      }))
    );

  /**
   * Add Demand always saves the rounds on screen as the demand's own copy, even when the user
   * never touched the list. Rounds are copied from the client ONCE, at creation; after that the
   * demand owns them, so a later change to the client's rounds never alters this demand.
   * (Without this, an untouched list was not sent and the demand kept inheriting the client.)
   */
  const submitWithRoundsSnapshot = (values: DemandFormState) => {
    if (isCreateMode && !values.interview_rounds && interviewRounds.length > 0) {
      onSubmit({ ...values, interview_rounds: toRoundsFieldValue(interviewRounds) });
      return;
    }
    onSubmit(values);
  };

  const amProfilesQuery = useAmProfilesQuery();
  const amOptions = amProfilesQuery.data.map((p) => ({ id: p.id, name: p.full_name, email: p.email, role: 'AM' }));
  const contactProfileId = watch('contact_profile_id');
  const resolvedAmOptions = initialAmLabel && contactProfileId && !amOptions.some((o) => o.id === contactProfileId)
    ? [{ id: contactProfileId, name: initialAmLabel, role: 'AM' }, ...amOptions]
    : amOptions;

  const spocProfilesQuery = useSpocProfilesQuery();
  const spocOptions = spocProfilesQuery.data.map((p) => ({ id: p.id, name: p.full_name, email: p.email, role: 'SPOC' }));
  const spocProfileId = watch('spoc_profile_id');
  const resolvedSpocOptions = initialSpocLabel && spocProfileId && !spocOptions.some((o) => o.id === spocProfileId)
    ? [{ id: spocProfileId, name: initialSpocLabel, role: 'SPOC' }, ...spocOptions]
    : spocOptions;

  const recruiterProfilesQuery = useRecruiterProfilesQuery();
  const recruiterOptions = recruiterProfilesQuery.data.map((p) => ({ id: p.id, name: p.full_name, email: p.email }));
  const recruiterIds = watch('recruiter_ids') ?? [];
  const missingRecruiterOptions = (initialRecruiterOptions ?? []).filter(
    (o) => recruiterIds.includes(o.id) && !recruiterOptions.some((opt) => opt.id === o.id)
  );
  const resolvedRecruiterOptions = missingRecruiterOptions.length > 0 ? [...missingRecruiterOptions, ...recruiterOptions] : recruiterOptions;

  // Currency / Compensation Type are master data configured in Demand Fulfillment Settings
  // — never hardcoded here. Missing a needed value means going to add it there, not
  // introducing a local/duplicate option.
  // In edit mode an inactive SAVED value still shows as a selected extra option (legacy
  // handling); saving it unchanged does not fail (grandfather clause on the backend).
  const currenciesQuery = useCompensationCurrenciesQuery();
  const savedCurrencyId = defaultValues.compensation_currency_id || '';
  const currencyOptions = [
    ...(currenciesQuery.data ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.symbol})` })),
    ...(savedCurrencyId && !(currenciesQuery.data ?? []).some((c) => c.id === savedCurrencyId)
      ? [{ value: savedCurrencyId, label: `${savedCurrencyId} (inactive)` }]
      : []),
  ];
  const compensationTypesQuery = useCompensationTypesQuery();
  const savedCompensationTypeId = defaultValues.compensation_type_id || '';
  const compensationTypeOptions = [
    ...(compensationTypesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    ...(savedCompensationTypeId && !(compensationTypesQuery.data ?? []).some((t) => t.id === savedCompensationTypeId)
      ? [{ value: savedCompensationTypeId, label: `${savedCompensationTypeId} (inactive)` }]
      : []),
  ];

  return (
    <form onSubmit={handleSubmit(submitWithRoundsSnapshot)} className="flex flex-col gap-3 rounded-[10px] bg-[#f8fafc] p-3.5">
      <SectionCard label="Client & Ownership">
        <div className={showAmSelector ? 'grid grid-cols-4 gap-2.5' : 'grid grid-cols-3 gap-2.5'}>
          <FormField
            label="Internal Request ID"
            placeholder={idFieldsReadOnlyPlaceholders ? 'Auto-generated if blank' : undefined}
            register={register('request_id', {
              validate: (value: string) => {
                // Edit mode is read-only, so only Add Demand ever has a value to judge.
                if (!isCreateMode && normalizeDemandRequestId(value ?? '') === initialRequestId) return true;
                const result = validateDemandRequestId(value);
                if (!result.ok) return result.error;
                // Rule: block the save when the probe already knows the ID is taken.
                if (isCreateMode && result.value !== '' && requestIdAvailability.data === false) {
                  return duplicateDemandRequestIdMessage(result.value);
                }
                return true;
              },
            })}
            // Uppercased and stripped as the user types or pastes; the API re-checks anyway.
            transform={sanitizeDemandRequestIdInput}
            readOnly={!isCreateMode}
            hint={isCreateMode ? DEMAND_REQUEST_ID_HINT : undefined}
            error={requestIdError}
          />
          {showAmSelector && (
            <Controller
              name="contact_profile_id"
              control={control}
              render={({ field }) => {
                // Auto-set AM to self for AM role in create mode.
                const amValue = isAccountManagerActor && isCreateMode && !field.value
                  ? currentUserId ?? ''
                  : field.value;
                return (
                  <UserSelect
                    mode="single"
                    label="Account Manager"
                    required={false}
                    placeholder="Select Account Manager (optional)"
                    options={resolvedAmOptions}
                    value={amValue}
                    onChange={(v) => field.onChange(v)}
                    isLoading={amProfilesQuery.isLoading}
                    error={errors.contact_profile_id?.message}
                    disabled={amSelectorDisabled}
                  />
                );
              }}
            />
          )}
          <Controller
            name="spoc_profile_id"
            control={control}
            render={({ field }) => (
              <UserSelect
                mode="single"
                label="SPOC"
                placeholder="Select SPOC (optional)"
                options={resolvedSpocOptions}
                value={field.value ?? ''}
                onChange={field.onChange}
                isLoading={spocProfilesQuery.isLoading}
                error={errors.spoc_profile_id?.message}
              />
            )}
          />
          <Controller
            name="recruiter_ids"
            control={control}
            render={({ field }) => (
              <UserSelect
                mode="multiple"
                label="Recruiter (TA)"
                placeholder="Select recruiters"
                options={resolvedRecruiterOptions}
                value={field.value}
                onChange={field.onChange}
                isLoading={recruiterProfilesQuery.isLoading}
                error={errors.recruiter_ids?.message}
              />
            )}
          />
        </div>
        {/* Company master: a searchable single-select replaces the old Client Name / Company Name /
            Company Email text inputs. Those values now live on the Company record and are mirrored
            onto the demand by the API. "+ Add Company" (create mode only) creates a real master
            row without leaving this form. */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* isCreateMode gates the quick-create button; the Company list itself is ALWAYS ACTIVE-only
              (create AND edit). In edit mode CompanySelect separately resolves the Demand's
              current company, so an INACTIVE one is still shown — tagged "Inactive" and
              non-selectable — instead of vanishing or silently being cleared on save. */}
          <Controller
            name="company_id"
            control={control}
            render={({ field }) => (
              <div title={!isCreateMode ? 'Client cannot be changed after the demand is created' : undefined}>
                <CompanySelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.company_id?.message}
                  currentUserRole={currentUserRole}
                  initialCompanyLabel={initialCompanyLabel}
                  // "+ Add Client" removed from the demand form (review, Nov 2026): clients are
                  // added in Client Management. The drawer code stays for a possible return.
                  allowQuickCreate={false}
                  disabled={!isCreateMode || !!clientLockedByDrawer}
                  onQuickCreate={onQuickCreate}
                  clientLockedByDrawer={clientLockedByDrawer}
                />
              </div>
            )}
          />
          <Controller
            name="end_client_id"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="End Client"
                options={endClientOptions}
                value={field.value}
                onChange={field.onChange}
                allowClear
                clearLabel="None"
                placeholder={endClientsQuery.isLoading ? 'Loading…' : 'Optional'}
              />
            )}
          />
          <Controller
            name="demand_type"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Demand Type"
                options={demandTypeOptions}
                value={field.value}
                onChange={field.onChange}
                allowClear
                clearLabel="None"
                placeholder={demandTypesQuery.isLoading ? 'Loading…' : 'Technical, Domain…'}
              />
            )}
          />
        </div>

        <Controller
          name="client_spoc_ids"
          control={control}
          render={({ field }) => (
            <ClientSpocField companyId={selectedCompanyId ?? ''} value={field.value ?? []} onChange={field.onChange} />
          )}
        />
      </SectionCard>

      <SectionCard label="Role Details">
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Job Title" required placeholder={idFieldsReadOnlyPlaceholders ? 'e.g. Senior Backend Engineer' : undefined} register={register('job_title')} error={errors.job_title?.message} />
          <FormTextArea label="Job Summary" required rows={1} placeholder="A short summary of the role" register={register('skill_description')} error={errors.skill_description?.message} />
        </div>
        <CustomerJdField
          register={register('customer_jd')}
          error={errors.customer_jd?.message}
          fileUrl={watch('customer_jd_file_url') ?? ''}
          fileName={watch('customer_jd_file_name') ?? ''}
          onFileChange={({ url, name }) => {
            setValue('customer_jd_file_url', url, { shouldDirty: true });
            setValue('customer_jd_file_name', name, { shouldDirty: true });
          }}
        />
        <FormTextArea label="Comments" rows={2} placeholder="Anything else the team should know about this demand" register={register('comments')} error={errors.comments?.message} />
        <FormTextArea label="Other Details" rows={2} placeholder={'Anything not covered by the fields above, one per line as "Label: value"'} register={register('other_details')} error={errors.other_details?.message} />
        <div>
          <Controller
            name="required_skills"
            control={control}
            render={({ field }) => (
              <SkillsSelector
                label="Required Skills"
                value={field.value}
                onChange={field.onChange}
                categoryId={skillsCategoryId}
                categoryPlaceholder="Select a skill group (optional)"
                onCategoryChange={(id) => setValue('skills_category_id', id, { shouldDirty: true })}
                suggestedCategoryIds={suggestedSkillGroupIds}
                suggestedReason={demandType ? `“${demandType}”` : undefined}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <FormField label="Client Demand Id" register={register('client_demand_id')} error={errors.client_demand_id?.message} />
          <FormField label="Intermediary Partner" register={register('intermediary_partner')} error={errors.intermediary_partner?.message} />
          <FormField label="Shift Timings" placeholder="e.g. 2 PM – 11 PM IST" register={register('shift_timings')} error={errors.shift_timings?.message} />
          <Controller
            name="engagement_type"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Engagement"
                options={[{ value: 'Proactive', label: 'Proactive' }, { value: 'Active', label: 'Active' }]}
                value={field.value}
                onChange={field.onChange}
                allowClear
                clearLabel="None"
                placeholder="Proactive or Active"
              />
            )}
          />
          <Controller
            name="role_category"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Demand Category"
                required
                options={categoryOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={categoriesQuery.isLoading}
                placeholder={categoriesQuery.isLoading ? 'Loading…' : 'Select a category'}
              />
            )}
          />
          {/* Free-text chip list, entered exactly like Locations — not tied to any master list. */}
          <Controller
            name="experience_levels"
            control={control}
            render={({ field }) => (
              <TagInput
                label="Experience Level"
                placeholder="Type a level and press Enter"
                value={field.value}
                onChange={field.onChange}
                error={errors.experience_levels?.message as string | undefined}
              />
            )}
          />
          <FormField label="Total Experience" placeholder="e.g. 6-8 yrs" register={register('total_experience')} error={errors.total_experience?.message} />
          <FormField label="Relevant Experience" placeholder="e.g. 4+ yrs in Selenium" register={register('relevant_experience')} error={errors.relevant_experience?.message} />
          <Controller
            name="work_modes"
            control={control}
            render={({ field }) => {
              const selected = field.value ?? [];
              return (
                <div>
                  <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">
                    Work Mode<span className="text-[#dc2626]"> *</span>
                  </div>
                  {/* Multi-select: a demand can allow more than one mode (e.g. Hybrid or Remote). */}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Work Mode">
                    {DEMAND_WORK_MODE_VALUES.map((mode) => {
                      const isOn = selected.includes(mode);
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={isOn}
                          onClick={() =>
                            field.onChange(
                              DEMAND_WORK_MODE_VALUES.filter((m) => (m === mode ? !isOn : selected.includes(m)))
                            )
                          }
                          className={cn(
                            'h-9 rounded-md border px-3 text-[0.8rem] font-medium transition-colors',
                            isOn ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'
                          )}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                  {errors.work_modes?.message && (
                    <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{errors.work_modes.message}</span>
                  )}
                </div>
              );
            }}
          />
        </div>
        <Controller
          name="certifications"
          control={control}
          render={({ field }) => (
            <CertificationsEditor
              value={field.value ?? []}
              onChange={field.onChange}
              error={errors.certifications?.message as string | undefined}
            />
          )}
        />
      </SectionCard>

      <SectionCard label="Compensation, Positions & Tracking">
        <div className="grid grid-cols-4 gap-2.5">
          <Controller
            name="compensation_currency_id"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Currency"
                options={currencyOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={currenciesQuery.isLoading}
                placeholder={currenciesQuery.isLoading ? 'Loading…' : 'Select currency (optional)…'}
              />
            )}
          />
          <Controller
            name="compensation_type_id"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Compensation Type"
                options={compensationTypeOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={compensationTypesQuery.isLoading}
                placeholder={compensationTypesQuery.isLoading ? 'Loading…' : 'Select type (optional)…'}
              />
            )}
          />
          {/* Free text: stored and displayed exactly as typed — no number parsing,
              no currency symbol, no digit grouping. */}
          <FormField
            label="Minimum Compensation"
            type="text"
            placeholder="e.g. 6LPA"
            register={register('compensation_min')}
            error={errors.compensation_min?.message}
          />
          <FormField
            label="Maximum Compensation"
            type="text"
            placeholder="e.g. 12LPA"
            register={register('compensation_max')}
            error={errors.compensation_max?.message}
          />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <FormField label="Positions" type="number" register={register('num_positions', { valueAsNumber: true })} />
          {!isCreateMode && (
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <FormSelect label="Status" required options={DEMAND_STATUS_OPTIONS} value={field.value} onChange={field.onChange} />
              )}
            />
          )}
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <FormSelect label="Priority" required options={PRIORITY_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="locations"
            control={control}
            render={({ field }) => (
              <LocationMultiSelect value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
      </SectionCard>

      <SectionCard label="Interview Rounds">
        {/* Placed last because rounds are needed from the Scheduled phase on, not to open a
            demand. The one reusable interview-round editor, seeded from the selected client's
            configured rounds only when this demand has no configuration of its own — see
            useDemandInterviewRounds (src/hooks/useDemandInterviewRounds.ts). */}
        <div>
          {((isCreateMode && companyRoundsLoading) || isLoadingOwnRounds) && (
            <div className="mb-2">
              <Loader message={isCreateMode ? "Loading this company's rounds…" : "Loading this demand's rounds…"} size="sm" />
            </div>
          )}
          <InterviewRoundConfigurator
            variant="demand"
            rounds={interviewRounds}
            onChange={(next) => {
              if (isCreateMode) {
                setInterviewRounds(next);
                setValue('interview_rounds', toRoundsFieldValue(next), { shouldValidate: false, shouldDirty: true });
                return;
              }
              if (next.length === 0 && interviewRounds.length > 0) {
                if (!window.confirm('Remove all rounds from this demand?')) return;
                setInterviewRounds(next);
                setValue('interview_rounds', '', { shouldValidate: false, shouldDirty: true });
                setValue('interview_rounds_cleared', true, { shouldValidate: false, shouldDirty: true });
                return;
              }

              setInterviewRounds(next);
              setValue('interview_rounds_cleared', false, { shouldValidate: false, shouldDirty: true });
              const unchanged = normalizeRoundsForCompare(next) === normalizeRoundsForCompare(initialOwnRounds);
              setValue('interview_rounds', unchanged ? '' : toRoundsFieldValue(next), { shouldValidate: false, shouldDirty: true });
            }}
            disabled={!canEditInterviewRounds}
            description={
              canEditInterviewRounds
                ? roundsSourceLabel
                : 'Read-only — only the assigned AM/SPOC or Super Admin can edit this.'
            }
            lockedInfo={(key) => {
              if (!key.startsWith || key.startsWith('name:')) return undefined;
              const count = roundInterviewCounts.get(key);
              if (!count) return undefined;
              return {
                locked: true,
                message: `Already used by ${count} interview${count === 1 ? '' : 's'} on this demand, so it cannot be deleted or renamed.`,
              };
            }}
          />
          <input type="hidden" {...register('interview_rounds')} readOnly />
        </div>
      </SectionCard>

      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-auto rounded-md border-[#e2e8f0] bg-white px-4 py-2 font-normal">Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="h-auto rounded-md px-4 py-2 font-semibold">{isSubmitting ? (pendingLabel ?? submitLabel) : submitLabel}</Button>
      </div>
    </form>
  );
}
