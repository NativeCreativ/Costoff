'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setFilter, setPage, setPageSize, setSearch, LISTS } from '@/features/listState/listStateSlice';
import { useCandidatesQuery } from '@/queries/candidates/useCandidatesQuery';
import {
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  getDuplicateCandidateError,
} from '@/queries/candidates/useCandidateMutations';
import { useCandidateHistoryQuery } from '@/queries/candidates/useCandidateHistoryQuery';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { CandidatesView } from '@/components/candidates/CandidatesView';
import { CandidateFormModal, type CandidateFormState } from '@/components/candidates/CandidateFormModal';
import { matchEnumOptionLoosely } from '@/components/candidates/candidate.schema';
import { DEMAND_WORK_MODE_VALUES } from '@/components/demands/demand.schema';
import { CandidateEditModal } from '@/components/candidates/CandidateEditModal';
import { CandidateDeleteConfirmModal } from '@/components/candidates/CandidateDeleteConfirmModal';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { CandidateHistoryDrawer } from '@/components/candidates/CandidateHistoryDrawer';
import { useLifecycleDrawer, getInterviewStatusStyle } from '@/hooks/useLifecycleDrawer';
import { canWriteCandidates } from '@/lib/auth/recordPermissions';
import { useDemandsQuery } from '@/queries/demands/useDemandsQuery';
import { DEMAND_TERMINAL_STATUS_VALUES } from '@/lib/demandFulfillment/constants';
import { EntitySelect } from '@/components/ui/EntitySelect';
import type { Candidate } from '@/components/types';
import { EMPTY_CANDIDATE_PROFILE_FIELDS, candidateProfileFormFields } from '@/components/candidates/candidateFormDefaults';
import { STAGE_COLORS } from '@/components/types';

const emptyCandidateForm: CandidateFormState = {
  full_name: '', email: '', phone: '', alternate_phone: '', current_location: '',
  preferred_locations: [], current_company: '', current_designation: '',
  total_experience: '', skills: [], skills_category_id: '', qualification: '', specialization: '',
  current_ctc: '', expected_ctc: '', available_from: '', availability: 'Immediate',
  work_mode: 'Work On Site', linked_url: '', source: 'naukri',
  offer_in_hand: 'no', offer_company: '', offer_ctc: '', offer_doj: '',
  ...EMPTY_CANDIDATE_PROFILE_FIELDS,
};

/** /candidates — the Candidate Pipeline list. */
export default function CandidatesPage() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.listState[LISTS.candidates]);
  const currentUserQuery = useCurrentUserQuery();
  // The Candidate 360 drawer links into a demand's lifecycle workspace, so that
  // drawer stays available on this route too.
  const { openLifecycle, overlays } = useLifecycleDrawer();

  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [candidateDedupeError, setCandidateDedupeError] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [showEditCandidateModal, setShowEditCandidateModal] = useState(false);
  const [editCandidateStage, setEditCandidateStage] = useState<string>('Sourced');
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(emptyCandidateForm);

  /* ── Candidate 360 history drawer ── */
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);
  const [candidateDrawerId, setCandidateDrawerId] = useState<string | null>(null);
  const candidateHistoryQuery = useCandidateHistoryQuery(candidateDrawerId, candidateDrawerOpen);
  const candidateDrawer = {
    open: candidateDrawerOpen,
    candidateId: candidateDrawerId,
    data: candidateHistoryQuery.data ?? null,
    loading: candidateHistoryQuery.isLoading,
  };
  const setCandidateDrawer = (updater: any) => {
    const next = typeof updater === 'function' ? updater(candidateDrawer) : updater;
    setCandidateDrawerOpen(next.open);
    setCandidateDrawerId(next.candidateId);
  };
  const openCandidateHistory = (candidateId: string) => {
    if (!candidateId) return;
    setCandidateDrawerId(candidateId);
    setCandidateDrawerOpen(true);
  };

  const filter = (key: string) => list.filters[key] ?? '';
  const setFilterValue = (key: string) => (v: string) =>
    dispatch(setFilter({ list: LISTS.candidates, key, value: v }));

  const candidatesQuery = useCandidatesQuery({
    search: list.search,
    source: filter('source'),
    workMode: filter('workMode'),
    page: list.page,
    pageSize: list.pageSize,
  });

  const createCandidateMutation = useCreateCandidateMutation();
  const updateCandidateMutation = useUpdateCandidateMutation();
  const deleteCandidateMutation = useDeleteCandidateMutation();
  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null);
  /** Set when the API refuses the delete (409 = candidate still in a live workflow, e.g. a
   *  scheduled interview). Surfaces the server's reason in a dialog instead of a native alert. */
  const [deleteBlocked, setDeleteBlocked] = useState<{ candidateName: string; message: string } | null>(null);

  // The Requirement is OPTIONAL for everyone who may add candidates (client decision, Nov
  // 2026): empty = the candidate goes into the database only; picked = also added to that
  // demand's pipeline. POST /api/candidates re-checks both cases server-side.
  const currentUserRole = currentUserQuery.data?.role;
  const canPickRequirement = canWriteCandidates(currentUserRole);
  const [createDemandId, setCreateDemandId] = useState('');
  const [createDemandSearch, setCreateDemandSearch] = useState('');
  // GET /api/demands already scopes to the actor's own demands server-side (ta via
  // demand_ta_allocations, account_manager via ownership) — the same visibility rule the
  // Demands list itself uses — so this option list can never show a demand outside their scope.
  const createDemandsQuery = useDemandsQuery(
    {
      search: createDemandSearch,
      excludeStatuses: DEMAND_TERMINAL_STATUS_VALUES.join(','),
      // Only demands the POST will accept: an AM's own demands, and for a Recruiter every
      // demand (any Recruiter may upload profiles — canUploadProfilesToDemand).
      uploadable: true,
      pageSize: 20,
    },
    { enabled: canPickRequirement && showCandidateModal }
  );
  const createDemandOptions = (createDemandsQuery.data?.data ?? []).map((d) => ({
    id: d.id,
    label: d.request_id,
    sublabel: [d.company_name, d.job_title || d.skill_description].filter(Boolean).join(' • '),
  }));

  const handleOpenCreateCandidate = () => {
    setCandidateForm(emptyCandidateForm);
    setCandidateDedupeError(null);
    setCreateDemandId('');
    setCreateDemandSearch('');
    setShowCandidateModal(true);
  };

  const handleCreateCandidate = (values: CandidateFormState) => {
    setCandidateDedupeError(null);
    // No requestId = database only; with one, the candidate is also linked to that demand in the
    // same call (the API re-checks the user may add profiles to it).
    createCandidateMutation.mutate({ form: values, requestId: createDemandId || undefined }, {
      onSuccess: () => {
        setShowCandidateModal(false);
        setCandidateForm(emptyCandidateForm);
      },
      onError: (err) => {
        const dup = getDuplicateCandidateError(err);
        if (dup) {
          setCandidateDedupeError(
            `🔴 ${dup.error} Existing profile: ${dup.existingCandidate?.full_name} (${dup.existingCandidate?.email})`,
          );
          return;
        }
        console.error('Error creating candidate:', err);
      },
    });
  };

  const handleEditCandidate = (c: Candidate) => {
    setEditingCandidate(c);
    setCandidateDedupeError(null);
    setCandidateForm({
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
      availability: (c.availability || 'Immediate') as CandidateFormState['availability'],
      work_mode: matchEnumOptionLoosely(c.work_mode, DEMAND_WORK_MODE_VALUES),
      linked_url: c.linked_url || '',
      source: (c.source || 'naukri') as CandidateFormState['source'],
      offer_in_hand: c.offer_in_hand ? 'yes' : 'no',
      offer_company: c.offer_company || '',
      offer_ctc: c.offer_ctc ? c.offer_ctc.toString() : '',
      offer_doj: c.offer_doj ? c.offer_doj.slice(0, 10) : '',
      ...candidateProfileFormFields(c),
    });
    setShowEditCandidateModal(true);
  };

  const handleUpdateCandidate = (values: CandidateFormState) => {
    if (!editingCandidate) return;
    setCandidateDedupeError(null);
    updateCandidateMutation.mutate(
      { id: editingCandidate.id, form: values },
      {
        onSuccess: () => {
          setShowEditCandidateModal(false);
          setEditingCandidate(null);
          setCandidateForm(emptyCandidateForm);
        },
        onError: (err) => {
          const dup = getDuplicateCandidateError(err);
          if (dup) {
            setCandidateDedupeError(dup.error);
            return;
          }
          console.error('Error updating candidate:', err);
        },
      },
    );
  };

  const renderStageTag = (stage: string) => {
    const colors = STAGE_COLORS[stage] || { bg: '#f1f5f9', text: '#475569' };
    return (
      <span
        className="whitespace-nowrap rounded px-2 py-0.5 text-[0.72rem] font-semibold"
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {stage}
      </span>
    );
  };

  return (
    <>
      <CandidatesView
        candidates={candidatesQuery.data?.data ?? []}
        loadingCandidates={candidatesQuery.isLoading}
        isFetching={candidatesQuery.isFetching}
        total={candidatesQuery.data?.total ?? 0}
        totalPages={candidatesQuery.data?.totalPages ?? 1}
        page={list.page}
        onPageChange={(page: number) => dispatch(setPage({ list: LISTS.candidates, page }))}
        pageSize={list.pageSize}
        onPageSizeChange={(pageSize: number) => dispatch(setPageSize({ list: LISTS.candidates, pageSize }))}
        candidateSearch={list.search}
        setCandidateSearch={(v: string) => dispatch(setSearch({ list: LISTS.candidates, value: v }))}
        candidateSourceFilter={filter('source')}
        setCandidateSourceFilter={setFilterValue('source')}
        candidateWorkModeFilter={filter('workMode')}
        setCandidateWorkModeFilter={setFilterValue('workMode')}
        candidateStageFilter={filter('stage')}
        setCandidateStageFilter={setFilterValue('stage')}
        setCandidateDedupeError={setCandidateDedupeError}
        setShowCandidateModal={(v) => (v ? handleOpenCreateCandidate() : setShowCandidateModal(false))}
        editCandidateStage={editCandidateStage}
        openCandidateHistory={openCandidateHistory}
        renderStageTag={renderStageTag}
        onEdit={handleEditCandidate}
        onDeleteRequest={(c: Candidate) => setDeletingCandidate(c)}
        canCreateCandidates={canWriteCandidates(currentUserQuery.data?.role)}
        canBulkDeleteCandidates={canWriteCandidates(currentUserQuery.data?.role)}
        canImportCandidates={canWriteCandidates(currentUserQuery.data?.role)}
        candidateExportFilters={{ search: list.search, source: filter('source'), workMode: filter('workMode') }}
      />

      {showCandidateModal && (
        <CandidateFormModal
          candidateForm={candidateForm}
          setCandidateForm={setCandidateForm}
          candidateDedupeError={candidateDedupeError}
          setShowCandidateModal={setShowCandidateModal}
          handleCreateCandidate={handleCreateCandidate}
          isSubmitting={createCandidateMutation.isPending}
          demandPicker={
            canPickRequirement ? (
              <EntitySelect
                mode="single"
                label="Requirement (optional)"
                placeholder="None — add to the candidate database only"
                searchPlaceholder="Search by Request ID, Company or Job Title…"
                options={createDemandOptions}
                value={createDemandId}
                onChange={setCreateDemandId}
                onSearchChange={setCreateDemandSearch}
                isLoading={createDemandsQuery.isLoading}
                emptyLabel="No requirement matches your search."
              />
            ) : undefined
          }
        />
      )}

      {showEditCandidateModal && editingCandidate && (
        <CandidateEditModal
          editingCandidate={editingCandidate}
          candidateForm={candidateForm}
          setCandidateForm={setCandidateForm}
          editCandidateStage={editCandidateStage}
          setEditCandidateStage={setEditCandidateStage}
          setShowEditCandidateModal={setShowEditCandidateModal}
          setEditingCandidate={setEditingCandidate}
          handleUpdateCandidate={handleUpdateCandidate}
          candidateDedupeError={candidateDedupeError}
          isSubmitting={updateCandidateMutation.isPending}
        />
      )}

      {deletingCandidate && (
        <CandidateDeleteConfirmModal
          deletingCandidate={deletingCandidate}
          onCancel={() => setDeletingCandidate(null)}
          onConfirm={(id: string) =>
            deleteCandidateMutation.mutate(id, {
              onSuccess: () => setDeletingCandidate(null),
              onError: (err) => {
                const msg = isAxiosError(err) ? (err.response?.data?.error as string | undefined) : undefined;
                if (msg) {
                  setDeletingCandidate(null);
                  setDeleteBlocked({
                    candidateName: deletingCandidate?.full_name || 'This candidate',
                    message: msg,
                  });
                } else {
                  console.error('Error archiving candidate:', err);
                }
              },
            })
          }
          isDeleting={deleteCandidateMutation.isPending}
        />
      )}

      {deleteBlocked && (
        <ErrorDialog
          title="Cannot Delete Candidate"
          description={`${deleteBlocked.candidateName} was not deleted.`}
          message={deleteBlocked.message}
          onClose={() => setDeleteBlocked(null)}
        />
      )}

      {candidateDrawer.open && (
        <CandidateHistoryDrawer
          candidateDrawer={candidateDrawer}
          setCandidateDrawer={setCandidateDrawer}
          openLifecycle={openLifecycle}
          getInterviewStatusStyle={getInterviewStatusStyle}
        />
      )}

      {overlays}
    </>
  );
}
