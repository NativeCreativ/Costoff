'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { useLifecycleQuery } from '@/queries/lifecycle/useLifecycleQuery';
import { useDemandAssignmentsQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useCreateDemandMutation } from '@/queries/demands/useDemandMutations';
import { DemandActionsBar } from './DemandActionsBar';
import { DemandLifecyclePanels } from './DemandLifecyclePanels';
import { useNamedMasterQuery } from '@/queries/masterData/useMasterData';
import { countByPhase } from '@/lib/demandFulfillment/lifecyclePhases';
import { DemandAssignModal } from './DemandAssignModal';
import { DemandFormModal, type DemandFormState } from '@/components/demands/DemandFormModal';
import type { DemandOnboarding, Profile, DemandAssignment } from '@/components/types';
import { canReassignDemandAccountManager, canChangeDemandStatus, canCloneDemand, canManageDemandPipeline, canUploadProfilesToDemand } from '@/lib/auth/demandFulfillmentPermissions';
import { canManageInterview } from '@/lib/auth/interviewPermissions';
import { buildDemandCloneForm } from '@/lib/demands/demandClone';
import { DEMAND_DETAIL_TABS, customPhaseTabId, demandDetailHref } from '@/lib/demandFulfillment/routes';
import { demandStatusLabel } from '@/lib/demands/demandStatusLabel';
import { formatDateTime } from '@/lib/utils';
import { toDemandCertifications, toFormWorkModes } from '@/components/demands/demand.schema';

interface DemandDetailViewProps {
  requestId: string;
  /**
   * Which section is active. Supplied by the route segment
   * (/demands/[requestId]/pipeline -> "pipeline") and normalized against the tab list,
   * so a retired or unknown value (e.g. ?tab=overview) renders Pipeline instead of an
   * empty page.
   */
  activeTab: string;
  currentUser: Profile | null;
  onBack: () => void;
}

export function DemandDetailView({ requestId, activeTab, currentUser, onBack }: DemandDetailViewProps) {
  const router = useRouter();
  const [showAssignModal, setShowAssignModal] = useState(false);
  // Clone Demand: the pre-filled (and still fully editable) Create Demand form, opened
  // from this Closed demand's actions bar.
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState<DemandFormState | null>(null);
  const createDemandMutation = useCreateDemandMutation();

  // The demand is fetched ONCE here, at page level, and the resulting `demand`,
  // `onboardings` and `assignments` are shared with the overview card, the actions bar
  // and the tabs — switching tabs never refetches the demand itself.
  const [coreOpen, setCoreOpen] = useState(true);
  const phasesQuery = useNamedMasterQuery('demand-phases');
  const lifecycleQuery = useLifecycleQuery(requestId, true);
  const assignmentsQuery = useDemandAssignmentsQuery(requestId);

  const demand = lifecycleQuery.data?.demand;
  const onboardings: DemandOnboarding[] = lifecycleQuery.data?.onboardings ?? [];
  const assignments: DemandAssignment[] = assignmentsQuery.data ?? [];
  // demand_assignments is an append-only history log — every Assign/Reassign save
  // adds new rows without deactivating old ones, so the same recruiter can appear
  // many times. Dedupe by user_id, keeping the most recent row per recruiter
  // (assignments are already ordered assigned_at desc, so first-seen wins), since
  // this feeds both the permission check and the Pipeline tab's recruiter filter.
  const recruiterAssignments = Array.from(
    assignments
      .filter((a) => a.role_in_demand === 'recruiter' && a.is_active)
      .reduce((byUserId, a) => (byUserId.has(a.user_id) ? byUserId : byUserId.set(a.user_id, a)), new Map<string, DemandAssignment>())
      .values()
  );

  const actor = { role: currentUser?.role, id: currentUser?.id };
  const canManageStatus = demand ? canChangeDemandStatus(actor, demand) : false;
  // Recruiter assignment for PERMISSION purposes must come from demand_ta_allocations
  // (the real FK table, exposed as demand.recruiter_ids by the lifecycle endpoint) — the
  // same source every API route uses via loadDemandContext.
  //
  // `recruiterAssignments` above is derived from demand_assignments, an append-only
  // history log that is EMPTY for any demand whose recruiters were allocated without
  // going through the Assign/Reassign flow. Using it here made canManagePipeline false
  // for legitimately-assigned recruiters, hiding Add Candidate on their own demand.
  // It is still used for the Pipeline tab's recruiter-filter dropdown, which genuinely
  // wants the assignment rows (they carry the display name).
  const recruiterIds = Array.isArray(demand?.recruiter_ids)
    ? (demand.recruiter_ids as string[])
    : recruiterAssignments.map((a) => a.user_id);
  const canManagePipeline = demand ? canManageDemandPipeline(actor, demand, recruiterIds) : false;
  // Wider than canManagePipeline: an unassigned Recruiter may still upload profiles.
  const canUploadProfiles = demand ? canUploadProfilesToDemand(actor, demand, recruiterIds) : false;
  // Interviews are read-only for SPOC even though they can manage the general pipeline —
  // canManageInterview excludes spoc from INTERVIEW_WRITE_ROLES where canManagePipeline wouldn't.
  const canManageInterviews = demand ? canManageInterview(actor, demand, recruiterIds) : false;
  // Clone is gated on the same ownership rule as every other demand write, in ANY status —
  // mirroring the backend's POST /api/demands guards; this UI gate is not the security boundary.
  const canClone = demand ? canCloneDemand(actor, demand) : false;

  const openCloneModal = () => {
    if (!demand || !canClone) return;
    setCloneForm(buildDemandCloneForm(demand));
    setShowCloneModal(true);
  };

  const submitClone = (values: DemandFormState) => {
    if (!demand || !cloneForm) return;
    createDemandMutation.mutate(
      { form: values, clonedFromDemandId: demand.id },
      {
        onSuccess: (created) => {
          setShowCloneModal(false);
          setCloneForm(null);
          // Show the newly generated Requirement ID: jump straight to the clone's detail
          // page, where the ID is in the overview card and the pipeline starts empty.
          router.push(demandDetailHref(created.request_id));
        },
      },
    );
  };

  if (lifecycleQuery.isLoading) {
    return <Loader message="Loading demand…" size="lg" />;
  }

  const submissions = lifecycleQuery.data?.submissions ?? [];
  const selectedClientSpocIds = new Set(demand?.client_spoc_ids ?? []);
  const clientSpocNames = (lifecycleQuery.data?.clientSpocs ?? [])
    .filter((spoc: { id: string; name: string }) => selectedClientSpocIds.has(spoc.id))
    .map((spoc: { name: string }) => spoc.name)
    .join(', ');
  const phaseCounts = countByPhase(submissions.map((row: { current_status?: string }) => row.current_status || ''));
  const knownPhaseNames = new Set(DEMAND_DETAIL_TABS.map((tab) => tab.phase.toLowerCase()));
  const visibleTabs = [
    ...DEMAND_DETAIL_TABS.map((tab) => {
      const count = phaseCounts[tab.id as keyof typeof phaseCounts];
      const name = phasesQuery.data?.find((phase) => phase.name.toLowerCase() === tab.phase.toLowerCase())?.name || tab.label;
      return { id: tab.id, label: typeof count === 'number' ? `${name} · ${count}` : name };
    }),
    ...(phasesQuery.data ?? [])
      .filter((phase) => phase.is_active && !knownPhaseNames.has(phase.name.toLowerCase()))
      .map((phase) => ({ id: customPhaseTabId(phase.name), label: phase.name })),
  ];
  const formDefaults: DemandFormState | null = demand ? {
    request_id: demand.request_id || '',
    company_id: demand.company_id || '',
    end_client_id: demand.end_client_id || '',
    demand_type: demand.demand_type || '',
    job_title: demand.job_title || '',
    skill_description: demand.skill_description || '',
    role_category: demand.role_category || 'Full Time',
    priority: (demand.priority || 'High') as DemandFormState['priority'],
    status: (demand.status || 'Open') as DemandFormState['status'],
    engagement_type: demand.engagement_type || '',
    client_demand_id: demand.client_demand_id || '',
    intermediary_partner: demand.intermediary_partner || '',
    shift_timings: demand.shift_timings || '',
    comments: demand.comments || '',
    other_details: demand.other_details || '',
    customer_jd: demand.customer_jd || '',
    customer_jd_file_url: demand.customer_jd_file_url || '',
    customer_jd_file_name: demand.customer_jd_file_name || '',
    client_spoc_ids: demand.client_spoc_ids || [],
    total_experience: demand.total_experience || '',
    relevant_experience: demand.relevant_experience || '',
    certifications: toDemandCertifications(demand.certifications),
    experience_levels: demand.experience_levels || [],
    required_skills: demand.technology_stack || [],
    skills_category_id: demand.skills_category_id || '',
    work_modes: toFormWorkModes(demand),
    compensation_currency_id: demand.compensation_currency_id || '',
    compensation_type_id: demand.compensation_type_id || '',
    compensation_min: demand.compensation_min || '',
    compensation_max: demand.compensation_max || '',
    locations: demand.locations || [],
    num_positions: demand.num_positions || 1,
    is_niche: demand.is_niche ?? false,
    contact_profile_id: demand.contact_profile_id || '',
    spoc_profile_id: demand.spoc_profile_id || '',
    recruiter_ids: demand.recruiter_ids || [],
  } : null;

  if (!demand) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#dc2626]">
        <p className="text-[0.9rem] font-semibold">Could not load this demand.</p>
        <Button variant="outline" onClick={onBack}>Back to Demands</Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onBack}
          title="Back"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Demand summary — shown on every tab. Replaces the old Overview tab and folds in
          the former page header (ID / company / technology / locations). */}
      <section className="rounded-xl border border-[#e2e8f0] bg-white">
        <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setCoreOpen((open) => !open)}>
          <span className="text-[0.78rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">Core details</span>
          <span className="text-[0.75rem] text-[#64748b]">{coreOpen ? 'Collapse' : 'Expand'}</span>
        </button>
        {coreOpen && (
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3">
            <CoreFact label="Aging" value={`${demand.days_open ?? 0}d`} />
            <CoreFact label="Demand Id" value={demand.request_id} />
            <CoreFact label="Client" value={demand.client_name || demand.company_name || '—'} />
            <CoreFact label="Client SPOC" value={clientSpocNames || '—'} />
            <CoreFact label="End client" value={demand.end_client_name || '—'} />
            <CoreFact label="Type" value={demand.demand_type || '—'} />
            <CoreFact label="Category" value={demand.role_category || '—'} />
            <CoreFact label="Skill group" value={demand.skill_group_name || '—'} />
            <CoreFact label="Status" value={demand.is_draft ? `Draft (not submitted) · ${demandStatusLabel(demand.status)}` : demandStatusLabel(demand.status)} />
          </div>
        )}
      </section>

      {/* "All Details" was removed (review, Nov 2026): every field is on the Details tab.
          The status buttons row (Move to…, Hold, Cancel, Close, Clone) was removed from the top
          of the page too (review of 18 Nov 2026, item 3) and now lives on the Closure tab. */}

      {/* Sticky under the 68px top header so the section stays reachable while scrolling a
          long pipeline / calendar / settings tab. */}
      <PhaseStatusBar submissions={submissions} />

      <div className="kanban-scroll sticky top-[68px] z-[4] -mx-1 flex max-w-full gap-1 overflow-x-auto border-b border-[#e2e8f0] bg-[var(--bg-main)]/95 px-1 backdrop-blur-sm">
        {visibleTabs.map((t) => (
          <Link
            key={t.id}
            href={demandDetailHref(requestId, t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-[0.85rem] font-semibold transition-colors ${activeTab === t.id ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#64748b] hover:text-[#0f172a]'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
        {activeTab === 'closure' && (
          <div className="mb-4">
            <div className="mb-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Demand status</div>
            <DemandActionsBar
              demand={demand}
              onboardings={onboardings}
              canManage={canManageStatus}
              onCloneRequest={canClone ? openCloneModal : undefined}
            />
          </div>
        )}
        <DemandLifecyclePanels
          requestId={requestId}
          activeTab={activeTab}
          demand={demand}
          submissions={submissions}
          interviews={lifecycleQuery.data?.interviews ?? []}
          clientSpocs={lifecycleQuery.data?.clientSpocs ?? []}
          assignmentEvents={lifecycleQuery.data?.assignmentEvents ?? []}
          canEditDemandFields={canManageStatus}
          canAssignAccountManager={canReassignDemandAccountManager(actor.role ?? '')}
          canManagePipeline={canManagePipeline}
          canUploadProfiles={canUploadProfiles}
          canReviewProfiles={!!lifecycleQuery.data?.can_review_profiles}
          currentUserId={currentUser?.id}
          canClose={canManageStatus}
          formDefaults={formDefaults}
        />
      </div>

      {/* Cloned-demand audit trail — was part of the old page header; it sits under the
          overview card rather than inside it so the card's layout stays uniform. */}
      {demand.cloned_from_demand_id && (
        <div className="inline-flex w-fit flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-[#e0e7ff] bg-[#eef2ff] px-2 py-1 text-[0.72rem] font-semibold text-[#4338ca]">
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Cloned Demand
          </span>
          {demand.cloned_from_request_id && (
            <>
              <span className="font-normal text-[#6366f1]">from</span>
              <Link
                href={demandDetailHref(demand.cloned_from_request_id)}
                className="underline underline-offset-2 hover:text-[#312e81]"
              >
                {demand.cloned_from_request_id}
              </Link>
            </>
          )}
          {demand.cloned_by_name && <span className="font-normal text-[#6366f1]">by {demand.cloned_by_name}</span>}
          {demand.cloned_at && <span className="font-normal text-[#6366f1]">on {formatDateTime(demand.cloned_at)}</span>}
        </div>
      )}

      {showAssignModal && (
        <DemandAssignModal
          requestId={requestId}
          demand={demand}
          currentAssignments={assignments}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      {showCloneModal && cloneForm && (
        <DemandFormModal
          demandForm={cloneForm}
          setDemandForm={setCloneForm}
          setShowDemandModal={(v) => { if (!v) setShowCloneModal(false); }}
          handleCreateDemand={submitClone}
          isSubmitting={createDemandMutation.isPending}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
          cloningFromRequestId={demand.request_id}
          initialAmLabel={demand.am_name}
          initialSpocLabel={demand.spoc_name}
          initialRecruiterOptions={recruiterIds.map((id: string, i: number) => ({
            id,
            name: demand.recruiter_names?.[i] || id,
          }))}
        />
      )}
    </div>
  );
}

function PhaseStatusBar({ submissions }: { submissions: { current_status?: string }[] }) {
  const counts = countByPhase(submissions.map((row) => row.current_status || ''));
  const total = submissions.length;
  const rows = [
    ['Sourcing', counts.sourcing],
    ['Shortlist', counts.shortlist],
    ['Selection', counts.selection],
    ['Onboarding', counts.onboarding],
    ['Other', Math.max(0, total - counts.sourcing - counts.shortlist - counts.selection - counts.onboarding)],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {rows.map(([label, count]) => {
        const percent = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <div key={label} className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">{label}</div>
            <div className="text-[0.95rem] font-semibold text-[#0f172a]">{count} <span className="text-[0.75rem] font-medium text-[#64748b]">({percent}%)</span></div>
          </div>
        );
      })}
    </div>
  );
}

function CoreFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">{label}</div>
      <div className="text-[0.9rem] font-semibold text-[#0f172a]">{value}</div>
    </div>
  );
}