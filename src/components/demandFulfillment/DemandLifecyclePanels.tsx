'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserSelect } from '@/components/ui/UserSelect';
import { useToast } from '@/components/ui/Toast';
import { DemandForm } from '@/components/demands/DemandForm';
import { DemandOnboardingTab } from './DemandOnboardingTab';
import { DemandChangeLogPanel } from './DemandChangeLogPanel';
import { CallLogPanel } from './CallLogPanel';
import { DemandInstructionsPanel } from './DemandInstructionsPanel';
import { SearchExistingCandidateModal, CreateCandidateForDemandModal } from './AddCandidateModal';
import { useDemandCandidatesQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { UserPlus, UserSearch } from 'lucide-react';
import { useChangeSubmissionStatusMutation, useReviewSourcedProfileMutation, useScheduleInterviewMutation, useUpdateInterviewMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { SourcedCandidateModal } from './SourcedCandidateModal';
import { useSpocProfilesQuery } from '@/queries/demands/useSpocProfilesQuery';
import { useAmProfilesQuery } from '@/queries/demands/useAmProfilesQuery';
import { useRecruiterProfilesQuery } from '@/queries/demands/useRecruiterProfilesQuery';
import { useUpdateDemandMutation } from '@/queries/demands/useDemandMutations';
import { assignDemand, closeDemand, updateSubmissionSourcingType } from '@/services/demandFulfillment.service';
import { demandStatusLabel } from '@/lib/demands/demandStatusLabel';
import { isCustomPhaseTab } from '@/lib/demandFulfillment/routes';
import { queryKeys } from '@/lib/queryKeys';
import { LIFECYCLE_PHASE_STATUSES } from '@/lib/demandFulfillment/lifecyclePhases';
import { useInterviewStatusOptions } from '@/components/interviews/useInterviewStatusOptions';
import type { Demand } from '@/components/types';
import type { DemandFormState } from '@/components/demands/DemandFormModal';

interface SubmissionRow {
  id: string;
  candidate_id?: string | null;
  current_status: string;
  sourcing_type?: string | null;
  added_by?: string | null;
  /** Sourcing review (batch 4): 'rejected' when the AM / SPOC sent it back. */
  review_state?: string | null;
  review_remark?: string | null;
  submitted_for_review_at?: string | null;
  candidates?: { full_name?: string; email?: string | null } | null;
}

interface InterviewRow {
  id: string;
  candidate_id?: string | null;
  status?: string | null;
  scheduled_date?: string | null;
  mode?: string | null;
  interview_type?: string | null;
  interview_location?: string | null;
  remark?: string | null;
  feedback?: string | null;
}

interface ClientSpoc {
  id: string;
  name: string;
  email?: string | null;
}

export function DemandLifecyclePanels({
  requestId,
  activeTab,
  demand,
  submissions,
  interviews,
  clientSpocs,
  assignmentEvents,
  canEditDemandFields,
  canAssignAccountManager = false,
  canManagePipeline,
  canUploadProfiles,
  canReviewProfiles = false,
  currentUserId,
  canClose,
  formDefaults,
}: {
  requestId: string;
  activeTab: string;
  demand: Demand;
  submissions: SubmissionRow[];
  interviews: InterviewRow[];
  clientSpocs: ClientSpoc[];
  assignmentEvents: { id: string; category: string; action: string; subject_id?: string | null; subject_label?: string | null; created_at?: string }[];
  canEditDemandFields: boolean;
  /** Delivery Head only: shows the Account Manager picker on the Assign tab. */
  canAssignAccountManager?: boolean;
  canManagePipeline: boolean;
  /** May add profiles (Sourced) — wider than canManagePipeline for unassigned Recruiters. */
  canUploadProfiles: boolean;
  /** AM / SPOC / Super Admin: approve or reject submitted Sourcing profiles. */
  canReviewProfiles?: boolean;
  currentUserId?: string;
  canClose: boolean;
  formDefaults: DemandFormState | null;
}) {
  if (activeTab === 'details' && formDefaults) {
    return <DetailsPanel requestId={requestId} demand={demand} canEdit={canEditDemandFields} formDefaults={formDefaults} />;
  }
  if (activeTab === 'assign') {
    return (
      <AssignPanel
        requestId={requestId}
        demand={demand}
        clientSpocs={clientSpocs}
        events={assignmentEvents}
        canEdit={canEditDemandFields}
        canAssignAccountManager={canAssignAccountManager}
      />
    );
  }
  if (activeTab === 'sourcing' || activeTab === 'shortlist' || activeTab === 'selection') {
    return (
      <CandidatePhasePanel
        requestId={requestId}
        phase={activeTab}
        submissions={submissions}
        interviews={interviews}
        canManage={canManagePipeline}
        canUpload={canUploadProfiles}
        canReview={canReviewProfiles}
        currentUserId={currentUserId}
      />
    );
  }
  if (activeTab === 'onboarding') {
    return <DemandOnboardingTab requestId={requestId} canManage={canManagePipeline} />;
  }
  if (activeTab === 'call-log') {
    return <CallLogPanel requestId={requestId} />;
  }
  if (activeTab === 'instructions') {
    return <DemandInstructionsPanel requestId={requestId} />;
  }
  if (activeTab === 'change-log') {
    return <DemandChangeLogPanel requestId={requestId} />;
  }
  if (activeTab === 'closure') {
    return <ClosurePanel requestId={requestId} canClose={canClose} status={demand.status} />;
  }
  if (isCustomPhaseTab(activeTab)) {
    return <ExtraPhasePanel label={activeTab.replace(/^phase-/, '').replace(/-/g, ' ')} />;
  }
  return null;
}

function ExtraPhasePanel({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#e2e8f0] p-4 text-[0.85rem] text-[#475569]">
      <p className="font-semibold capitalize text-[#0f172a]">{label}</p>
      <p className="mt-1">This phase was added in Demand Phase master data. Candidates still move through Details, Assign, Sourcing, Shortlist, Selection, Onboarding, and Closure. Per-position status inside a demand is still pending.</p>
    </div>
  );
}

function DetailsPanel({ requestId, demand, canEdit, formDefaults }: { requestId: string; demand: Demand; canEdit: boolean; formDefaults: DemandFormState }) {
  const updateMutation = useUpdateDemandMutation();
  const toast = useToast();
  if (!canEdit) {
    return <p className="text-[0.85rem] text-[#64748b]">Demand fields are view-only here. Edit them from Demand Management if your role allows it.</p>;
  }
  return (
    <DemandForm
      defaultValues={formDefaults}
      editingDemand={demand}
      submitLabel={demand.is_draft ? 'Save draft' : 'Save demand'}
      secondaryAction={demand.is_draft ? { label: 'Submit to team', values: { publish: true } } : undefined}
      pendingLabel="Saving…"
      isSubmitting={updateMutation.isPending}
      onCancel={() => undefined}
      onSubmit={(values) => {
        updateMutation.mutate(
          { id: demand.id, form: values },
          {
            onSuccess: () => toast.success(values.publish ? 'Demand submitted — the team can see it now' : 'Demand updated'),
            onError: () => toast.error('Save failed', 'Could not update this demand'),
          }
        );
      }}
      idFieldsReadOnlyPlaceholders={false}
    />
  );
}

function AssignPanel({
  requestId,
  demand,
  clientSpocs,
  events,
  canEdit,
  canAssignAccountManager,
}: {
  requestId: string;
  demand: Demand;
  clientSpocs: ClientSpoc[];
  events: { id: string; category: string; action: string; subject_id?: string | null; subject_label?: string | null; created_at?: string }[];
  canEdit: boolean;
  canAssignAccountManager: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const spocProfiles = useSpocProfilesQuery();
  const recruiterProfiles = useRecruiterProfilesQuery();
  const amProfiles = useAmProfilesQuery();
  const [amId, setAmId] = useState(demand.contact_profile_id || '');
  const [spocId, setSpocId] = useState(demand.spoc_profile_id || '');
  const [recruiterIds, setRecruiterIds] = useState<string[]>(demand.recruiter_ids ?? []);
  const [clientSpocIds, setClientSpocIds] = useState<string[]>(demand.client_spoc_ids ?? []);

  const amOptions = amProfiles.data.map((profile) => ({ id: profile.id, name: profile.full_name, email: profile.email, role: 'AM' }));
  const spocOptions = spocProfiles.data.map((profile) => ({ id: profile.id, name: profile.full_name, email: profile.email, role: 'SPOC' }));
  const recruiterOptions = recruiterProfiles.data.map((profile) => ({ id: profile.id, name: profile.full_name, email: profile.email, role: 'TA' }));

  const save = useMutation({
    mutationFn: () => {
      const assignments: { user_id: string; role_in_demand: 'account_manager' | 'spoc' | 'recruiter' }[] = [
        ...(canAssignAccountManager && amId && amId !== demand.contact_profile_id ? [{ user_id: amId, role_in_demand: 'account_manager' as const }] : []),
        ...(spocId ? [{ user_id: spocId, role_in_demand: 'spoc' as const }] : []),
        ...recruiterIds.map((id) => ({ user_id: id, role_in_demand: 'recruiter' as const })),
      ];
      const clearRoles: ('account_manager' | 'spoc' | 'recruiter')[] = [
        ...(canAssignAccountManager && !amId && demand.contact_profile_id ? ['account_manager' as const] : []),
        ...(!spocId && demand.spoc_profile_id ? ['spoc' as const] : []),
        ...(recruiterIds.length === 0 && (demand.recruiter_ids?.length ?? 0) > 0 ? ['recruiter' as const] : []),
      ];
      return assignDemand(requestId, { assignments, clear_roles: clearRoles, client_spoc_ids: clientSpocIds });
    },
    onSuccess: () => {
      toast.success('Assignment saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandAssignments(requestId) });
    },
    onError: () => toast.error('Assign failed', 'Could not update the team'),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.8rem] text-[#64748b]">
        Search by name to assign or clear {canAssignAccountManager ? 'the Account Manager, ' : ''}Costaff SPOCs and recruiters, and tick client SPOCs. Clearing a person removes them. Each change is written to the assignment log.
      </p>
      {canAssignAccountManager ? (
        <UserSelect
          mode="single"
          label="Account Manager"
          placeholder="Search Account Manager…"
          options={amOptions}
          value={amId}
          onChange={setAmId}
          disabled={!canEdit}
          isLoading={amProfiles.isLoading}
          selectedLabel={demand.am_name || undefined}
        />
      ) : demand.am_name ? (
        <div className="text-[0.82rem]"><span className="font-semibold text-[#475569]">Account Manager:</span> {demand.am_name}</div>
      ) : null}
      <UserSelect
        mode="single"
        label="Costaff SPOC"
        placeholder="Search Costaff SPOC…"
        options={spocOptions}
        value={spocId}
        onChange={setSpocId}
        disabled={!canEdit}
        isLoading={spocProfiles.isLoading}
        selectedLabel={demand.spoc_name || undefined}
      />
      {canEdit && spocId && (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setSpocId('')}>Unassign Costaff SPOC</Button>
      )}
      <UserSelect
        mode="multiple"
        label="TA / Recruiters"
        placeholder="Search recruiters…"
        options={recruiterOptions}
        value={recruiterIds}
        onChange={setRecruiterIds}
        disabled={!canEdit}
        isLoading={recruiterProfiles.isLoading}
      />
      {canEdit && recruiterIds.length > 0 && (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setRecruiterIds([])}>Unassign all recruiters</Button>
      )}
      <div>
        <div className="mb-1 text-[0.8rem] font-semibold">Client SPOCs</div>
        {clientSpocs.length === 0 && <p className="text-[0.78rem] text-[#94a3b8]">This client has no SPOCs yet. Add them in Client Management.</p>}
        {clientSpocs.map((spoc) => (
          <label key={spoc.id} className="flex items-center gap-2 text-[0.82rem]">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={clientSpocIds.includes(spoc.id)}
              onChange={(e) => {
                setClientSpocIds((current) => e.target.checked ? [...current, spoc.id] : current.filter((id) => id !== spoc.id));
              }}
            />
            {spoc.name}{spoc.email ? ` · ${spoc.email}` : ''}
          </label>
        ))}
      </div>
      {canEdit && <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>Save assignment</Button>}
      <div>
        <div className="mb-1 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">Changelog</div>
        {events.length === 0 && <p className="text-[0.78rem] text-[#94a3b8]">No assignment changes recorded yet.</p>}
        <ul className="flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.id} className="text-[0.78rem] text-[#334155]">
              {event.action} · {event.category.replace(/_/g, ' ')} · {event.subject_label || event.subject_id || '—'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const INTERVIEW_TYPES = ['Technical', 'Functional', 'Managerial'] as const;
const INTERVIEW_MODES = ['InPerson', 'Video'] as const;
const INTERVIEW_LOCATIONS = ['Teams', 'Direct_Call'] as const;

function CandidatePhasePanel({
  requestId,
  phase,
  submissions,
  interviews,
  canManage,
  canUpload,
  canReview,
  currentUserId,
}: {
  requestId: string;
  phase: 'sourcing' | 'shortlist' | 'selection';
  submissions: SubmissionRow[];
  interviews: InterviewRow[];
  canManage: boolean;
  canUpload: boolean;
  canReview: boolean;
  currentUserId?: string;
}) {
  const review = useReviewSourcedProfileMutation(requestId);
  const [viewing, setViewing] = useState<{ candidateId: string; editable: boolean } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Saving / submitting a Sourcing profile: the pipeline team, or whoever uploaded it.
  const canSubmitRow = (row: SubmissionRow) => canManage || (!!currentUserId && row.added_by === currentUserId);
  const [addMode, setAddMode] = useState<'existing' | 'new' | null>(null);
  const showUpload = phase === 'sourcing' && canUpload;
  // The add modals report the Active/Backup cap; only fetched where the buttons show.
  const capQuery = useDemandCandidatesQuery(showUpload ? requestId : '', {});
  const cap = capQuery.data?.cap ?? { cap: 0, current: 0, reached: false };
  const rows = submissions.filter((row) => (LIFECYCLE_PHASE_STATUSES[phase] as readonly string[]).includes(row.current_status));
  const statusMutation = useChangeSubmissionStatusMutation(requestId);
  const schedule = useScheduleInterviewMutation(requestId);
  const updateInterview = useUpdateInterviewMutation(requestId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { transition } = useInterviewStatusOptions();
  const [draft, setDraft] = useState<Record<string, { date: string; time: string; status: string; comment: string; type: string; mode: string; location: string; result: string }>>({});
  const sourcingType = useMutation({
    mutationFn: ({ dcId, sourcingType }: { dcId: string; sourcingType: 'active' | 'backup' }) =>
      updateSubmissionSourcingType(requestId, dcId, sourcingType),
    onSuccess: () => {
      toast.success('Sourcing type updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
    },
    onError: () => toast.error('Update failed', 'Could not change Active / Backup'),
  });

  const move = (id: string, to: string, remark?: string) => {
    statusMutation.mutate({ dcId: id, to_status: to, remark });
  };

  const refreshAfterAdd = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Upload profiles: the assigned team, plus any Recruiter even when not assigned
          (canUploadProfilesToDemand). The per-row controls below stay behind canManage. */}
      {showUpload && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!canManage && (
            <span className="mr-auto text-[0.75rem] text-[#64748b]">
              You are not assigned to this demand. You can upload profiles; the assigned team takes them forward.
            </span>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddMode('existing')}>
            <UserSearch className="h-4 w-4" /> Add Existing Candidate
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddMode('new')}>
            <UserPlus className="h-4 w-4" /> Add New Candidate
          </Button>
        </div>
      )}
      {addMode === 'existing' && (
        <SearchExistingCandidateModal requestId={requestId} cap={cap} onClose={() => setAddMode(null)} onAdded={refreshAfterAdd} />
      )}
      {addMode === 'new' && (
        <CreateCandidateForDemandModal requestId={requestId} cap={cap} onClose={() => setAddMode(null)} onAdded={refreshAfterAdd} />
      )}
      {viewing && (
        <SourcedCandidateModal requestId={requestId} candidateId={viewing.candidateId} editable={viewing.editable} onClose={() => setViewing(null)} />
      )}
      {rejecting && (
        <Modal title={`Reject ${rejecting.name}`} subtitle="The recruiter sees this reason and can fix the profile and submit again." onClose={() => setRejecting(null)} closeDisabled={review.isPending}>
          <div className="flex flex-col gap-3">
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this profile rejected?"
              className="w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.82rem] shadow-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejecting(null)} disabled={review.isPending}>Cancel</Button>
              <Button
                type="button"
                disabled={review.isPending || !rejectReason.trim()}
                onClick={() => review.mutate({ dcId: rejecting.id, action: 'reject', remark: rejectReason.trim() }, { onSuccess: () => setRejecting(null) })}
              >
                {review.isPending ? 'Rejecting…' : 'Reject profile'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {phase === 'sourcing' && rows.some((r) => r.current_status === 'submitted_to_spoc') && canReview && (
        <p className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-[0.78rem] text-[#1e40af]">
          {rows.filter((r) => r.current_status === 'submitted_to_spoc').length} profile(s) waiting for your approval.
        </p>
      )}
      {rows.length === 0 && <p className="text-[0.85rem] text-[#94a3b8]">No candidates in this phase.</p>}
      {rows.map((row) => {
        const local = draft[row.id] || { date: '', time: '', status: 'Completed', comment: '', type: 'Technical', mode: 'Video', location: 'Teams', result: 'pass' };
        const interview = interviews.find((item) => item.candidate_id && item.candidate_id === row.candidate_id);
        return (
          <div key={row.id} className="rounded-md border border-[#e2e8f0] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <button
                  type="button"
                  className="font-semibold text-[#2563eb] hover:underline"
                  onClick={() => row.candidate_id && setViewing({
                    candidateId: row.candidate_id,
                    editable: phase === 'sourcing' && row.current_status === 'sourced' && canSubmitRow(row),
                  })}
                >
                  {row.candidates?.full_name || 'Candidate'}
                </button>
                <div className="text-[0.75rem] text-[#64748b]">
                  {phase === 'sourcing'
                    ? row.current_status === 'submitted_to_spoc' ? 'Submitted — waiting for AM / SPOC' : row.review_state === 'rejected' ? 'Rejected by AM / SPOC' : 'Saved (not submitted)'
                    : row.current_status.replace(/_/g, ' ')}
                  {' · '}{row.sourcing_type === 'backup' ? 'Backup' : 'Active'}
                  {interview ? ` · ${interview.interview_type || '—'} · ${interview.mode || '—'} · ${interview.interview_location || '—'}` : ''}
                </div>
                {phase === 'sourcing' && row.review_state === 'rejected' && row.current_status === 'sourced' && row.review_remark && (
                  <div className="mt-1 rounded bg-[#fef2f2] px-2 py-1 text-[0.74rem] text-[#b91c1c]">Reason: {row.review_remark}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {phase === 'sourcing' && row.current_status === 'sourced' && canSubmitRow(row) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => row.candidate_id && setViewing({ candidateId: row.candidate_id, editable: true })}>Edit details</Button>
                    {row.sourcing_type === 'backup' ? (
                      <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ dcId: row.id, action: 'submit_as_active' })}>Submit as Active</Button>
                    ) : (
                      <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ dcId: row.id, action: 'submit' })}>
                        {row.review_state === 'rejected' ? 'Re-submit' : 'Submit'}
                      </Button>
                    )}
                  </>
                )}
                {phase === 'sourcing' && row.current_status === 'submitted_to_spoc' && canReview && (
                  <>
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ dcId: row.id, action: 'approve' })}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => { setRejectReason(''); setRejecting({ id: row.id, name: row.candidates?.full_name || 'this candidate' }); }}>Reject</Button>
                  </>
                )}
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sourcingType.isPending}
                    onClick={() => sourcingType.mutate({ dcId: row.id, sourcingType: row.sourcing_type === 'backup' ? 'active' : 'backup' })}
                  >
                    Mark {row.sourcing_type === 'backup' ? 'Active' : 'Backup'}
                  </Button>
                )}
                {canManage && phase === 'shortlist' && (
                  <>
                    <Button size="sm" onClick={() => move(row.id, 'customer_shortlisted', 'Customer shortlisted')}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => move(row.id, 'shortlist_reject', 'Shortlist rejected')}>Reject</Button>
                  </>
                )}
                {canManage && phase === 'selection' && (
                  <Button size="sm" onClick={() => move(row.id, 'selected', 'Selected')}>Mark selected</Button>
                )}
              </div>
            </div>
            {phase === 'selection' && canManage && (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input type="date" aria-label="Interview date" value={local.date} onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, date: e.target.value } }))} />
                <Input type="time" aria-label="Interview time" value={local.time} onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, time: e.target.value } }))} />
                <select
                  aria-label="Interview type"
                  className="button-select w-full text-[0.8rem]"
                  value={local.type}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, type: e.target.value } }))}
                >
                  {INTERVIEW_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select
                  aria-label="Interview mode"
                  className="button-select w-full text-[0.8rem]"
                  value={local.mode}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, mode: e.target.value } }))}
                >
                  {INTERVIEW_MODES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select
                  aria-label="Interview location"
                  className="button-select w-full text-[0.8rem]"
                  value={local.location}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, location: e.target.value } }))}
                >
                  {INTERVIEW_LOCATIONS.map((option) => <option key={option} value={option}>{option === 'Direct_Call' ? 'Direct call' : option}</option>)}
                </select>
                <select
                  aria-label="Interview status"
                  className="button-select w-full text-[0.8rem]"
                  value={local.status}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, status: e.target.value } }))}
                >
                  {transition.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {local.status === 'Completed' && (
                  <select
                    aria-label="Interview result"
                    className="button-select w-full text-[0.8rem]"
                    value={local.result}
                    onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, result: e.target.value } }))}
                  >
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="on_hold">On hold</option>
                  </select>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!local.date) return;
                    schedule.mutate({
                      dcId: row.id,
                      payload: {
                        scheduled_date: local.date,
                        scheduled_time: local.time || undefined,
                        mode: local.mode,
                        interview_type: local.type as 'Technical' | 'Functional' | 'Managerial',
                        interview_location: local.location as 'Teams' | 'Direct_Call',
                        remark: local.comment || undefined,
                      },
                    });
                  }}
                >
                  Schedule
                </Button>
                <Textarea
                  rows={2}
                  className="md:col-span-3"
                  placeholder="Comment appended to the interview log"
                  value={local.comment}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.id]: { ...local, comment: e.target.value } }))}
                />
                {interview && (
                  <Button
                    size="sm"
                    onClick={() => updateInterview.mutate({
                      interviewId: interview.id,
                      payload: {
                        status: local.status,
                        mode: local.mode,
                        interview_type: local.type as 'Technical' | 'Functional' | 'Managerial',
                        interview_location: local.location as 'Teams' | 'Direct_Call',
                        result: local.status === 'Completed' ? (local.result as 'pass' | 'fail' | 'on_hold') : undefined,
                        remark: local.comment || undefined,
                        feedback: [interview.feedback, local.comment].filter(Boolean).join('\n') || undefined,
                      },
                    })}
                  >
                    Update status
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClosurePanel({ requestId, canClose, status }: { requestId: string; canClose: boolean; status: string }) {
  const [comment, setComment] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => closeDemand(requestId, comment),
    onSuccess: () => {
      toast.success('Demand closed');
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
    },
    onError: () => toast.error('Close failed', 'Could not close this demand'),
  });
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-[0.85rem] text-[#475569]">Current status: <strong>{demandStatusLabel(status)}</strong>. Closing comments are stored on the demand and any open onboarding rows.</p>
      <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Closing comments" disabled={!canClose || status === 'Closure'} />
      {canClose && status !== 'Closure' && (
        <Button type="button" disabled={!comment.trim() || close.isPending} onClick={() => close.mutate()}>Close demand</Button>
      )}
    </div>
  );
}
