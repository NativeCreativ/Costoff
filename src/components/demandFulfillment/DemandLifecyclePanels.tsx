'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { useChangeSubmissionStatusMutation, useScheduleInterviewMutation, useUpdateInterviewMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { useSpocProfilesQuery } from '@/queries/demands/useSpocProfilesQuery';
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
  canManagePipeline,
  canUploadProfiles,
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
  canManagePipeline: boolean;
  /** May add profiles (Sourced) — wider than canManagePipeline for unassigned Recruiters. */
  canUploadProfiles: boolean;
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
      />
    );
  }
  if (activeTab === 'onboarding') {
    return <DemandOnboardingTab requestId={requestId} canManage={canManagePipeline} />;
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
      submitLabel="Save demand"
      pendingLabel="Saving…"
      isSubmitting={updateMutation.isPending}
      onCancel={() => undefined}
      onSubmit={(values) => {
        updateMutation.mutate(
          { id: demand.id, form: values },
          {
            onSuccess: () => toast.success('Demand updated'),
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
}: {
  requestId: string;
  demand: Demand;
  clientSpocs: ClientSpoc[];
  events: { id: string; category: string; action: string; subject_id?: string | null; subject_label?: string | null; created_at?: string }[];
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const spocProfiles = useSpocProfilesQuery();
  const recruiterProfiles = useRecruiterProfilesQuery();
  const [spocId, setSpocId] = useState(demand.spoc_profile_id || '');
  const [recruiterIds, setRecruiterIds] = useState<string[]>(demand.recruiter_ids ?? []);
  const [clientSpocIds, setClientSpocIds] = useState<string[]>(demand.client_spoc_ids ?? []);

  const spocOptions = spocProfiles.data.map((profile) => ({ id: profile.id, name: profile.full_name, email: profile.email, role: 'SPOC' }));
  const recruiterOptions = recruiterProfiles.data.map((profile) => ({ id: profile.id, name: profile.full_name, email: profile.email, role: 'TA' }));

  const save = useMutation({
    mutationFn: () => {
      const assignments: { user_id: string; role_in_demand: 'spoc' | 'recruiter' }[] = [
        ...(spocId ? [{ user_id: spocId, role_in_demand: 'spoc' as const }] : []),
        ...recruiterIds.map((id) => ({ user_id: id, role_in_demand: 'recruiter' as const })),
      ];
      const clearRoles: ('spoc' | 'recruiter')[] = [
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
        Search by name to assign or clear Costaff SPOCs and recruiters, and tick client SPOCs. Clearing a person removes them. Each change is written to the assignment log.
      </p>
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
}: {
  requestId: string;
  phase: 'sourcing' | 'shortlist' | 'selection';
  submissions: SubmissionRow[];
  interviews: InterviewRow[];
  canManage: boolean;
  canUpload: boolean;
}) {
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
      {/* Call Log lives on Sourcing: calls are how profiles are found (a "Fit" call adds one here). */}
      {phase === 'sourcing' && <CallLogPanel requestId={requestId} />}
      {rows.length === 0 && <p className="text-[0.85rem] text-[#94a3b8]">No candidates in this phase.</p>}
      {rows.map((row) => {
        const local = draft[row.id] || { date: '', time: '', status: 'Completed', comment: '', type: 'Technical', mode: 'Video', location: 'Teams', result: 'pass' };
        const interview = interviews.find((item) => item.candidate_id && item.candidate_id === row.candidate_id);
        return (
          <div key={row.id} className="rounded-md border border-[#e2e8f0] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-[#0f172a]">{row.candidates?.full_name || 'Candidate'}</div>
                <div className="text-[0.75rem] text-[#64748b]">
                  {row.current_status.replace(/_/g, ' ')} · {row.sourcing_type === 'backup' ? 'Backup' : 'Active'}
                  {interview ? ` · ${interview.interview_type || '—'} · ${interview.mode || '—'} · ${interview.interview_location || '—'}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
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
                {canManage && phase === 'sourcing' && (
                  <Button size="sm" onClick={() => move(row.id, 'shortlisted_internal')}>Approve to shortlist</Button>
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
