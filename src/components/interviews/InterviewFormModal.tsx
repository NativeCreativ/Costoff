'use client';

import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { EntitySelect, type EntityOption } from '@/components/ui/EntitySelect';
import { Button } from '@/components/ui/button';
import { interviewSchema } from './interview.schema';
import { useDemandsQuery } from '@/queries/demands/useDemandsQuery';
import { useDemandOwnInterviewRoundsQuery, useDemandCandidatesQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useAddDemandCandidateMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { getCandidates } from '@/services/candidate.service';
import { queryKeys } from '@/lib/queryKeys';
import { useDebounce } from '@/hooks/useDebounce';
import { matchedSkillNames } from '@/lib/skills';
import {
  INTERVIEW_COMPLETED_STATUS,
  INTERVIEW_RESULT_OPTIONS,
  INTERVIEW_LINK_STATUS_OPTIONS,
} from '@/constants/options';
import { calculateDurationMinutes, formatDurationMinutes } from '@/lib/utils';
import { DEMAND_TERMINAL_STATUS_VALUES } from '@/lib/demandFulfillment/constants';
import { submissionSourceForCandidate } from '@/lib/candidates/candidateSource';
import { useInterviewStatusOptions } from '@/components/interviews/useInterviewStatusOptions';

export interface InterviewFormState {
  demand_id: string;
  candidate_id: string;
  /** The configured round's real id (demand_interview_rounds.id) — the source of truth. Round
   *  and Mode are one field; the round's own mode is derived from it server-side, never sent
   *  separately. */
  round_id: string;
  scheduled_date: string;
  scheduled_time: string;
  end_time: string;
  /** Auto-calculated from scheduled_time/end_time — never user-editable. */
  duration_minutes: number | null;
  link_status: string;
  meeting_link: string;
  status: string;
  /** Only meaningful (and only sent) for a Completed interview — see interviewSchema. */
  result?: string;
}

interface InterviewFormModalProps {
  interviewForm: InterviewFormState;
  setInterviewForm: (v: InterviewFormState) => void;
  setShowInterviewModal: (v: boolean) => void;
  handleCreateInterview: (values: InterviewFormState) => void;
  isSubmitting?: boolean;
  /** When set, the modal renders as an Edit form for an existing interview instead of Create. */
  mode?: 'create' | 'edit';
  /** Edit mode only: labels to show for the (disabled) Request ID / Candidate selects, since
   *  their DB-backed option lists are searched fresh and may not include the existing values. */
  initialDemandLabel?: string;
  initialCandidateLabel?: string;
  /** Edit mode only: the currently-assigned round's display name (e.g. interview.level),
   *  shown immediately instead of a blank Round select while that demand's rounds are
   *  still loading — same "resolved options" fix as Request ID/Candidate above. */
  initialRoundLabel?: string;
}

export function InterviewFormModal({
  interviewForm,
  setInterviewForm,
  setShowInterviewModal,
  handleCreateInterview,
  isSubmitting,
  mode = 'create',
  initialDemandLabel,
  initialCandidateLabel,
  initialRoundLabel,
}: InterviewFormModalProps) {
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<InterviewFormState>({
    resolver: zodResolver(interviewSchema),
    defaultValues: interviewForm,
  });

  const isEdit = mode === 'edit';
  const { transition: transitionStatusOptions } = useInterviewStatusOptions();

  // Request ID (Demand) is a DB-backed searchable select — typing debounces into a real
  // search query (matches Request ID, Company Name and Job Title server-side — see
  // DEMAND_SEARCH_TEXT_FIELDS), never a client-side filter of an already-loaded page.
  //
  // Only demands that are still ELIGIBLE for recruitment are offered: terminal demands
  // (Closure / Cancelled) are excluded, because a finished requirement cannot take a new
  // interview round. The rule is DEMAND status only — a demand whose Company has since gone
  // INACTIVE is still listed, because that company's existing recruitment is unaffected. The
  // server re-checks the same rule on submit (isDemandRecruitmentActive), so this list is UX.
  const [demandSearch, setDemandSearch] = useState('');
  const demandsQuery = useDemandsQuery({
    search: demandSearch,
    excludeStatuses: DEMAND_TERMINAL_STATUS_VALUES.join(','),
    pageSize: 20,
  });
  const demandOptions = (demandsQuery.data?.data ?? []).map((d) => ({
    id: d.id,
    label: d.request_id,
    sublabel: [d.company_name, d.job_title || d.skill_description].filter(Boolean).join(' • '),
  }));

  // In edit mode the existing demand may not be in the current (short, searched) option
  // list — ensure its selected value still renders a label instead of the raw id.
  const demandId = watch('demand_id');
  const resolvedDemandOptions = isEdit && initialDemandLabel && !demandOptions.some((o) => o.id === demandId)
    ? [{ id: demandId, label: initialDemandLabel }, ...demandOptions]
    : demandOptions;

  // This demand's OWN saved interview rounds and required skills — never the company/global
  // fallback chain, and never read from Demand Fulfillment Settings (see
  // getDemandOwnInterviewRounds / the route's own doc comment).
  const ownRoundsQuery = useDemandOwnInterviewRoundsQuery(demandId || null);
  const requiredSkills = ownRoundsQuery.data?.requiredSkills ?? [];
  const hasNoRequiredSkills = !!demandId && !ownRoundsQuery.isLoading && requiredSkills.length === 0;

  // Candidate is ALWAYS skill-matched against the selected demand's required skills — a
  // candidate is never offered just because they exist, UNLESS the demand has no required
  // skills configured, in which case every candidate from the same two sources qualifies
  // (nothing to filter against). Two sources, both fed by the same skill-matching
  // implementation (buildRawSkillOverlapWhere, src/lib/search.ts):
  //   1. the demand's own pipeline, narrowed with ?matchSkills=true, and
  //   2. the master candidates table via GET /api/candidates?requestId=<demandId> — the
  //      exact call the "Add Existing Candidate" picker already makes.
  // Candidates already in the pipeline are listed once ("In pipeline"); the rest are
  // listed as "Add to pipeline" and get attached on submit through the existing
  // POST /api/demands/[requestId]/candidates flow (which re-enforces permission, the
  // resume cap and the duplicate/rejected-submission rules server-side).
  const [candidateSearch, setCandidateSearch] = useState('');
  const debouncedCandidateSearch = useDebounce(candidateSearch, 400);
  const candidatesQuery = useDemandCandidatesQuery(demandId || null, { matchSkills: true });
  const masterCandidatesQuery = useQuery({
    // Distinct key from AddCandidateModal's ['candidates-search', ...] on purpose: this
    // one requests a different page size, so sharing the key would serve either surface
    // the other's cached page.
    queryKey: ['demand-interview-eligible-candidates', debouncedCandidateSearch, demandId, hasNoRequiredSkills],
    queryFn: () => getCandidates({
      search: debouncedCandidateSearch,
      pageSize: 20,
      requestId: demandId as string,
      allowAllWhenNoSkills: hasNoRequiredSkills,
    }),
    enabled: !!demandId && !ownRoundsQuery.isLoading,
    staleTime: 30 * 1000,
  });

  const pipelineRows = (candidatesQuery.data?.candidates ?? []).filter(
    (row) => row.is_active !== false && row.candidates
  );
  const pipelineCandidateIds = new Set(pipelineRows.map((row) => row.candidates!.id));

  // EntitySelect defers filtering to the server once onSearchChange is set, so the small
  // pipeline list is narrowed here by the same term instead (keeps the pre-existing
  // "typing narrows the pipeline" behaviour of this control).
  const searchTerm = debouncedCandidateSearch.trim().toLowerCase();
  const matchesSearch = (label?: string | null, sublabel?: string | null) =>
    !searchTerm || [label, sublabel].some((v) => v?.toLowerCase().includes(searchTerm));

  /** "<email> • 3 skills match: React, Node.js" (or just the email when there is nothing to
   *  report a match for — no required skills, so everyone trivially qualifies). */
  const matchSublabel = (email: string, skills?: string[] | null) => {
    if (requiredSkills.length === 0) return email;
    const matched = matchedSkillNames(requiredSkills, skills);
    if (matched.length === 0) return email;
    return `${email} • ${matched.length} skill${matched.length === 1 ? '' : 's'} match: ${matched.join(', ')}`;
  };

  const candidateOptions: (EntityOption & { source?: string })[] = [
    ...pipelineRows
      .map((row) => ({
        id: row.candidates!.id,
        label: row.candidates!.full_name,
        sublabel: matchSublabel(row.candidates!.email, row.candidates!.skills),
        tag: 'In pipeline',
        source: row.candidates?.source ?? undefined,
      }))
      .filter((o) => matchesSearch(o.label, o.sublabel)),
    ...(masterCandidatesQuery.data?.data ?? [])
      .filter((c) => !pipelineCandidateIds.has(c.id) && matchesSearch(c.full_name, c.email))
      .map((c) => ({
        id: c.id,
        label: c.full_name,
        sublabel: matchSublabel(c.email, c.skills),
        tag: 'Add to pipeline',
        source: c.source ?? undefined,
      })),
  ];

  const candidateId = watch('candidate_id');
  const resolvedCandidateOptions = isEdit && initialCandidateLabel && !candidateOptions.some((o) => o.id === candidateId)
    ? [{ id: candidateId, label: initialCandidateLabel }, ...candidateOptions]
    : candidateOptions;

  // Interview Round (merged with Mode) must come from the selected Demand's OWN saved rounds —
  // never the company/global/hardcoded fallback chain, and never free-typed.
  const rounds = [...(ownRoundsQuery.data?.rounds ?? [])].sort((a, b) => a.round_order - b.round_order);
  const roundOptions: EntityOption[] = rounds.map((r) => ({
    id: r.id,
    label: r.mode ? `${r.name} · ${r.mode}` : r.name,
  }));

  const roundId = watch('round_id');
  // A saved round the demand no longer has (removed/renamed since this interview was scheduled)
  // still shows as the current value — reference-only, same pattern EntitySelect already uses
  // for a Demand's own inactive Company (see EntitySelect.tsx) — so an old schedule never breaks
  // and is never forced to change its round.
  const resolvedRoundOptions = isEdit && initialRoundLabel && roundId && !roundOptions.some((o) => o.id === roundId)
    ? [{ id: roundId, label: initialRoundLabel, tag: 'not in demand anymore', disabled: true }, ...roundOptions]
    : roundOptions;

  // Only clear Round/Candidate on an actual (user-driven) demand change — never keep a
  // stale Round/Candidate -> Demand link (matches the instruction: changing Demand clears
  // both), but never wipe Edit's pre-filled values either. Tracked by comparing against the
  // previous demandId rather than a "have we run yet" ref/boolean: React 18 Strict Mode
  // (enabled via next.config.js) double-invokes a fresh effect on mount without resetting
  // refs between the two invocations, so a boolean flips to "already ran" on the first
  // invocation and then incorrectly treats the second, same-deps invocation as a real
  // change — wiping the just-set Edit defaultValues immediately after mount. Comparing the
  // actual previous value is invocation-count-proof: on mount (and on Strict Mode's replay)
  // prevDemandId.current === demandId trivially, so nothing is cleared until demandId
  // genuinely changes to something else.
  const prevDemandId = useRef(demandId);
  useEffect(() => {
    if (prevDemandId.current !== demandId) {
      setValue('round_id', '');
      setValue('candidate_id', '');
    }
    prevDemandId.current = demandId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandId]);

  // Never keep an invalid Round -> Demand relationship: if the demand's rounds loaded and the
  // currently-selected round no longer belongs to it, clear it. Create mode only — in Edit mode
  // a stale round is kept on purpose (reference-only, tagged "not in demand anymore" above) so
  // an old schedule is never forced to change its round just by being opened.
  useEffect(() => {
    if (!demandId || isEdit) return;
    if (ownRoundsQuery.isLoading) return;
    if (roundId && !rounds.some((r) => r.id === roundId)) {
      setValue('round_id', '');
    }
  }, [demandId, isEdit, ownRoundsQuery.isLoading, rounds.map((r) => r.id).join('|')]);

  // Duration is auto-calculated from Start/End Time — never manually entered. Recalculates
  // immediately on either field changing; stays empty if either is missing or the range is
  // invalid (end not strictly after start — the existing end-after-start refine already
  // surfaces that as a validation error, so Duration just stays blank rather than showing
  // a bogus negative/zero value).
  const scheduledTime = watch('scheduled_time');
  const endTime = watch('end_time');
  const status = watch('status');

  // The current status ('Scheduled' on a freshly-created interview) is deliberately excluded
  // from INTERVIEW_STATUS_TRANSITION_OPTIONS (see comment there), so Radix's Select finds no
  // matching item for it and renders blank instead of falling back to the placeholder. Same
  // "resolved options" fix as Request ID/Candidate/Round above: inject it as a synthetic,
  // selected-but-not-re-selectable option so the field shows the real current status.
  const resolvedStatusOptions = status && !transitionStatusOptions.some((o) => o.value === status)
    ? [{ value: status, label: status }, ...transitionStatusOptions]
    : transitionStatusOptions;

  // Result belongs to a Completed interview and nothing else: switching away from Completed
  // drops it, and switching to it demands one (the schema refine blocks the save otherwise).
  // Switching TO Scheduled is a re-schedule (e.g. round 1 came back a No-Show and round 2
  // has to be booked) — the Interview Round select above, which is always required, is what
  // says which round is being booked.
  const handleStatusChange = (next: string) => {
    setValue('status', next);
    if (next !== INTERVIEW_COMPLETED_STATUS) setValue('result', '');
  };
  const durationMinutes = calculateDurationMinutes(scheduledTime, endTime);
  useEffect(() => {
    setValue('duration_minutes', durationMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMinutes]);

  const close = () => setShowInterviewModal(false);

  // Attach-on-submit: a selected candidate that is not in the demand pipeline yet goes
  // through the existing "Add Existing Candidate" endpoint (POST
  // /api/demands/[requestId]/candidates) first, so permission, the resume cap, the
  // duplicate check and the "previously rejected/dropped" rule all stay enforced by the
  // one place that already owns them. A candidate that is already in the pipeline is
  // never re-submitted. Edit mode is untouched — an existing interview always already has
  // its submission.
  const addToPipelineMutation = useAddDemandCandidateMutation(demandId || '');
  const queryClient = useQueryClient();
  const [attachError, setAttachError] = useState<string | null>(null);
  const isBusy = isSubmitting || addToPipelineMutation.isPending;

  const onSubmit = (values: InterviewFormState) => {
    setInterviewForm(values);
    if (isEdit || !values.demand_id || pipelineCandidateIds.has(values.candidate_id)) {
      handleCreateInterview(values);
      return;
    }
    setAttachError(null);

    // Use the selected candidate's source for the new pipeline entry.
    const selectedCandidate = candidateOptions.find((o) => o.id === values.candidate_id);
    const candidateSource = selectedCandidate?.source ?? undefined;
    const pipelineSource = submissionSourceForCandidate(candidateSource) ?? undefined;

    addToPipelineMutation.mutate(
      { candidate_id: values.candidate_id, source: pipelineSource },
      {
        onSuccess: () => {
          // The shared hook above invalidates the unfiltered pipeline key, which does not
          // prefix-match this modal's skill-filtered one — refresh it explicitly so the
          // candidate is immediately shown as "In pipeline" instead of offering a re-add.
          queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidates(values.demand_id, { matchSkills: true }) });
          handleCreateInterview(values);
        },
        onError: (err) => setAttachError(
          isAxiosError(err)
            ? err.response?.data?.error || 'Failed to add this candidate to the requirement pipeline'
            : 'Failed to add this candidate to the requirement pipeline'
        ),
      }
    );
  };

  return (
    <Modal title={isEdit ? 'Edit Interview' : 'Schedule New Interview'} subtitle="Link interview slot dynamically to candidate & demand" onClose={close} closeDisabled={isBusy}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="demand_id"
            control={control}
            render={({ field }) => (
              <EntitySelect
                mode="single"
                label="Request ID"
                required
                placeholder="Search requirement…"
                searchPlaceholder="Search by Request ID, Company, or Job Title…"
                options={resolvedDemandOptions}
                value={field.value}
                onChange={field.onChange}
                onSearchChange={setDemandSearch}
                isLoading={demandsQuery.isLoading}
                error={errors.demand_id?.message}
                disabled={isEdit}
              />
            )}
          />
          <div>
            <Controller
              name="candidate_id"
              control={control}
              render={({ field }) => (
                <EntitySelect
                  mode="single"
                  label="Candidate"
                  required
                  placeholder={!demandId ? 'Select a Request first' : 'Search candidate…'}
                  searchPlaceholder="Search by name or email…"
                  emptyLabel={!demandId ? 'No results found' : "No candidates match this demand's skills."}
                  options={resolvedCandidateOptions}
                  value={field.value}
                  onChange={(v) => { setAttachError(null); field.onChange(v); }}
                  onSearchChange={setCandidateSearch}
                  // isFetching (not isLoading) so a demand switch — which the pipeline query
                  // answers with keepPreviousData — can never leave another demand's
                  // candidates selectable.
                  isLoading={!!demandId && (ownRoundsQuery.isLoading || candidatesQuery.isFetching || masterCandidatesQuery.isFetching)}
                  error={errors.candidate_id?.message}
                  disabled={isEdit || !demandId}
                />
              )}
            />
            {!isEdit && hasNoRequiredSkills && (
              <span className="mt-1 block text-[0.72rem] text-[#64748b]">
                This demand has no required skills, showing all candidates.
              </span>
            )}
            {!isEdit && demandId && !hasNoRequiredSkills && !candidatesQuery.isFetching && !masterCandidatesQuery.isFetching && candidateOptions.length === 0 && (
              <span className="mt-1 block text-[0.72rem] text-[#64748b]">
                Candidates are matched on this requirement&apos;s required skills. Add one from its Pipeline tab if a non-matching profile must be interviewed.
              </span>
            )}
            {attachError && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{attachError}</span>}
            {!isEdit && demandId && (candidatesQuery.isError || masterCandidatesQuery.isError) && (
              <span className="mt-1 block text-[0.72rem] text-[#dc2626]">Failed to load candidates for this requirement. Please try again.</span>
            )}
          </div>
        </div>

        <div>
          {/* Round and Mode are one field: each option reads "Round name · Mode" (mode in muted
              text via EntitySelect's sublabel/tag convention, omitted when the round has none).
              The mode is never independently editable — it travels with whichever round is
              picked, snapshotted as plain text on save (see POST/PATCH /api/interviews). */}
          <Controller
            name="round_id"
            control={control}
            render={({ field }) => (
              <EntitySelect
                mode="single"
                label="Interview Round and Mode"
                required
                placeholder={
                  !demandId
                    ? 'Select a Requirement first'
                    : ownRoundsQuery.isLoading
                    ? 'Loading rounds…'
                    : rounds.length === 0
                    ? 'No round for this demand'
                    : 'Select round…'
                }
                searchPlaceholder="Search rounds…"
                options={resolvedRoundOptions}
                value={field.value}
                onChange={field.onChange}
                isLoading={!!demandId && ownRoundsQuery.isLoading}
                error={errors.round_id?.message}
                disabled={!demandId || ownRoundsQuery.isLoading || rounds.length === 0}
              />
            )}
          />
          {demandId && !ownRoundsQuery.isLoading && ownRoundsQuery.isError && (
            <span className="mt-1 block text-[0.72rem] text-[#dc2626]">Failed to load interview rounds. Please try again.</span>
          )}
          {demandId && !ownRoundsQuery.isLoading && !ownRoundsQuery.isError && rounds.length === 0 && (
            <span className="mt-1 block text-[0.72rem] text-[#dc2626]">
              No interview rounds are set for this demand. Add them in Edit Demand first.
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Create always lands as 'Scheduled', so there is nothing to pick — the status
              picker only exists when editing an already-created interview, and even then
              'Scheduled' is not offered (it is the creation state, not a transition). */}
          {isEdit ? (
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <FormSelect
                  label="Status"
                  placeholder="Select status…"
                  options={resolvedStatusOptions}
                  value={field.value}
                  onChange={handleStatusChange}
                />
              )}
            />
          ) : (
            <div>
              <label className="mb-1 block font-semibold text-[#0.8rem] text-[#475569]">Status</label>
              <input
                type="text"
                readOnly
                disabled
                value="Scheduled"
                className="h-9 w-full cursor-not-allowed rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[0.85rem] text-[#64748b] shadow-none"
              />
            </div>
          )}
          <FormField label="Scheduled Date" required type="date" min={new Date().toISOString().split('T')[0]} register={register('scheduled_date')} error={errors.scheduled_date?.message} />
        </div>

        {/* A Result only exists to describe an interview that actually happened, so it is
            asked for — and required — exactly when the status is Completed. */}
        {isEdit && status === INTERVIEW_COMPLETED_STATUS && (
          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="result"
              control={control}
              render={({ field }) => (
                <FormSelect
                  label="Result"
                  required
                  placeholder="Select result…"
                  options={INTERVIEW_RESULT_OPTIONS}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.result?.message}
                />
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Start Time" required type="time" register={register('scheduled_time')} error={errors.scheduled_time?.message} />
          <FormField
            label="End Time"
            required
            type="time"
            register={register('end_time', {
              validate: (value: string) => {
                const start = watch('scheduled_time');
                if (value && start && value <= start) {
                  return 'End time must be after the start time';
                }
                return true;
              },
            })}
            error={errors.end_time?.message}
          />
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Duration (Auto Calculated)</label>
            <input
              type="text"
              readOnly
              disabled
              value={formatDurationMinutes(durationMinutes) || '—'}
              className="h-9 w-full cursor-not-allowed rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[0.85rem] text-[#64748b] shadow-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Controller
            name="link_status"
            control={control}
            render={({ field }) => (
              <FormSelect label="Link Status" options={INTERVIEW_LINK_STATUS_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
          <FormField label="Meeting Link / Video Call URL" type="url" placeholder="https://teams.microsoft.com/l/meetup-join/..." register={register('meeting_link')} />
        </div>

        <div className="mt-2.5 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={close} disabled={isBusy} className="h-auto rounded-md border-[#e2e8f0] px-4 py-2 font-normal">Cancel</Button>
          <Button type="submit" disabled={isBusy} className="h-auto rounded-md px-4 py-2 font-semibold">
            {isBusy ? (isEdit ? 'Saving…' : 'Scheduling…') : (isEdit ? 'Save Changes' : 'Schedule Slot')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
