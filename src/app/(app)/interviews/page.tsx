'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setFilter, setPage, setPageSize, setSearch, LISTS } from '@/features/listState/listStateSlice';
import {
  canCreateInterviewFromModule,
  getInterviewRowActions,
  normalizeInterviewResult,
  INTERVIEW_WRITE_ROLES,
} from '@/lib/auth/interviewPermissions';
import { useInterviewsQuery } from '@/queries/interviews/useInterviewsQuery';
import { useInterviewFilterOptionsQuery } from '@/queries/interviews/useInterviewFilterOptionsQuery';
import {
  useCreateInterviewMutation,
  useUpdateInterviewMutation,
  useDeleteInterviewMutation,
} from '@/queries/interviews/useInterviewMutations';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { InterviewsView } from '@/components/interviews/InterviewsView';
import {
  InterviewFormModal,
  type InterviewFormState,
} from '@/components/interviews/InterviewFormModal';
import { InterviewDetailModal } from '@/components/interviews/InterviewDetailModal';
import { InterviewDeleteConfirmModal } from '@/components/interviews/InterviewDeleteConfirmModal';
import { useLifecycleDrawer, getInterviewStatusStyle } from '@/hooks/useLifecycleDrawer';
import type { Interview } from '@/components/types';

const emptyInterviewForm: InterviewFormState = {
  demand_id: '', candidate_id: '', round_id: '',
  scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '10:00',
  end_time: '', duration_minutes: null, link_status: 'Client_Shared',
  meeting_link: '', status: 'Scheduled',
};

/** /interviews — the Interviews & Schedules list. */
export default function InterviewsPage() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.listState[LISTS.interviews]);
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;
  const { openLifecycle, overlays } = useLifecycleDrawer();

  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [interviewForm, setInterviewForm] = useState<InterviewFormState>(emptyInterviewForm);
  const [showEditInterviewModal, setShowEditInterviewModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [editingInterviewDemandLabel, setEditingInterviewDemandLabel] = useState('');
  const [editingInterviewCandidateLabel, setEditingInterviewCandidateLabel] = useState('');
  const [deletingInterview, setDeletingInterview] = useState<Interview | null>(null);
  /** Locally-edited results, keyed by interview id — see the overlay below. */
  const [resultOverrides, setResultOverrides] = useState<Record<string, string | null>>({});
  const [deleteInterviewError, setDeleteInterviewError] = useState<string | null>(null);

  const filter = (key: string) => list.filters[key] ?? '';
  const setFilterValue = (key: string) => (v: string) =>
    dispatch(setFilter({ list: LISTS.interviews, key, value: v }));

  const interviewsQuery = useInterviewsQuery({
    search: list.search,
    round: filter('round'),
    mode: filter('mode'),
    status: filter('status'),
    result: filter('result'),
    company: filter('company'),
    am: filter('am'),
    dateFrom: filter('dateFrom'),
    dateTo: filter('dateTo'),
    page: list.page,
    pageSize: list.pageSize,
  });

  // Filter-option dropdowns: separate endpoints, scoped only by role visibility (NOT by page/filter/search/pagination).
  // Each one refetches only when its search text changes.
  const [companySearch, setCompanySearch] = useState('');
  const [amSearch, setAmSearch] = useState('');
  const [roundSearch, setRoundSearch] = useState('');
  const [modeSearch, setModeSearch] = useState('');
  const companyOptionsQuery = useInterviewFilterOptionsQuery('company', companySearch);
  const amOptionsQuery = useInterviewFilterOptionsQuery('am', amSearch);
  const roundOptionsQuery = useInterviewFilterOptionsQuery('round', roundSearch);
  const modeOptionsQuery = useInterviewFilterOptionsQuery('mode', modeSearch);

  // Hold onto the label of the currently-selected value so it stays visible in the field
  // even when it drops out of the (searched/limited) option list.
  const selectedCompanyLabel = (companyOptionsQuery.data || []).find((o) => o.value === filter('company'))?.label ?? '';
  const selectedAmLabel = (amOptionsQuery.data || []).find((o) => o.value === filter('am'))?.label ?? '';

  const createInterviewMutation = useCreateInterviewMutation();
  const updateInterviewMutation = useUpdateInterviewMutation();
  const deleteInterviewMutation = useDeleteInterviewMutation();

  const openEditInterview = (interview: Interview) => {
    setEditingInterview(interview);
    setInterviewForm({
      demand_id: interview.demand_id || '',
      candidate_id: interview.candidate_id || '',
      round_id: interview.round_id || '',
      scheduled_date: interview.scheduled_date || '',
      scheduled_time: interview.scheduled_time || '',
      end_time: interview.end_time || '',
      duration_minutes: interview.duration_minutes ?? null,
      link_status: interview.link_status || 'Client_Shared',
      meeting_link: interview.meeting_link || '',
      status: interview.status || 'Scheduled',
      // Only sent back for a Completed interview; any other status drops it (see the
      // schema refine), so an edited No-Show can never keep a stale result.
      result: interview.result || undefined,
    });
    setEditingInterviewDemandLabel(interview.demand_request_id || '');
    setEditingInterviewCandidateLabel(interview.candidate_name || '');
    setSelectedInterview(null);
    setShowEditInterviewModal(true);
  };

  const handleUpdateInterview = (values: InterviewFormState) => {
    if (!editingInterview) return;
    updateInterviewMutation.mutate(
      { id: editingInterview.id, form: values },
      {
        onSuccess: (updated) => {
          // Apply the new result locally right away: the edit may flip it between on hold,
          // pass and fail, which immediately changes which row actions are available.
          setResultOverrides((prev) => ({ ...prev, [updated.id]: updated.result ?? null }));
          setShowEditInterviewModal(false);
          setEditingInterview(null);
          setInterviewForm(emptyInterviewForm);
        },
        onError: (err) => console.error('Error updating interview:', err),
      },
    );
  };

  // Always open Create with a clean slate — without this, reopening after an Edit (or a
  // previous Create) would carry over that form's stale Request ID/Status into the new one,
  // since `interviewForm` isn't otherwise reset until a submit succeeds.
  const openCreateInterview = () => {
    setInterviewForm(emptyInterviewForm);
    setShowInterviewModal(true);
  };

  const handleCreateInterview = (values: InterviewFormState) => {
    createInterviewMutation.mutate(values, {
      onSuccess: () => {
        setShowInterviewModal(false);
        setInterviewForm(emptyInterviewForm);
      },
      onError: (err) => console.error('Error scheduling interview:', err),
    });
  };

  // Row actions come from the ONE shared helper (lib/auth/interviewPermissions): the existing
  // role/ownership check (can_manage, computed server-side by the same canEditInterview rule
  // the mutating routes enforce — `can_add` is the looser demand-assignment rule and would
  // NOT gate editing) combined with the interview's own STATUS rule (Completed locks it,
  // regardless of result; every other status stays open). Evaluated per round — never from a
  // candidate's other interview rounds.
  const getInterviewActions = (item: Interview) =>
    getInterviewRowActions(
      { status: item.status },
      { role: currentUser?.role, canManage: !!item.can_manage, blockedReason: item.manage_blocked_reason }
    );

  // "Schedule Interview" on the direct /interviews screen is open to Super Admin, Account
  // Manager and Recruiter (ta); SPOC/HR/Viewer schedule from the candidate's demand pipeline
  // instead. POST /api/interviews enforces the same role gate server-side, plus a further
  // per-demand ownership/assignment check that applies to every role including ta/AM.
  const canScheduleInterview = canCreateInterviewFromModule(currentUser?.role);
  // Role gate only — bulk-select/status-change/delete is visible to roles that can ever
  // manage an interview at all; the real per-item ownership/status check always happens
  // server-side (and is reported back per row if it fails).
  const canBulkManageInterviews = !!currentUser?.role && INTERVIEW_WRITE_ROLES.includes(currentUser.role);

  const serverInterviews = interviewsQuery.data?.interviews ?? [];

  // Results edited in this session are overlaid on the fetched rows so the row's actions
  // re-evaluate the moment an edit lands — no page reload and no waiting on the refetch.
  // Each override is dropped again as soon as the server value catches up.
  useEffect(() => {
    setResultOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next: Record<string, string | null> = {};
      let changed = false;
      for (const [id, value] of Object.entries(prev)) {
        const fresh = serverInterviews.find((iv) => iv.id === id);
        if (fresh && normalizeInterviewResult(fresh.result) === normalizeInterviewResult(value)) changed = true;
        else next[id] = value;
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [serverInterviews]);

  const interviews = useMemo(
    () => serverInterviews.map((iv) =>
      Object.prototype.hasOwnProperty.call(resultOverrides, iv.id) ? { ...iv, result: resultOverrides[iv.id] } : iv
    ),
    [serverInterviews, resultOverrides]
  );

  return (
    <>
      <InterviewsView
        interviews={interviews}
        loadingInterviews={interviewsQuery.isLoading}
        interviewSearch={list.search}
        setInterviewSearch={(v: string) => dispatch(setSearch({ list: LISTS.interviews, value: v }))}
        roundFilter={filter('round')}
        setRoundFilter={setFilterValue('round')}
        interviewRoundOptions={roundOptionsQuery.data || []}
        roundOptionsLoading={roundOptionsQuery.isFetching}
        roundOnSearchChange={setRoundSearch}
        modeFilter={filter('mode')}
        setModeFilter={setFilterValue('mode')}
        interviewModeOptions={modeOptionsQuery.data || []}
        modeOptionsLoading={modeOptionsQuery.isFetching}
        modeOnSearchChange={setModeSearch}
        interviewStatusFilter={filter('status')}
        setInterviewStatusFilter={setFilterValue('status')}
        resultFilter={filter('result')}
        setResultFilter={setFilterValue('result')}
        companyFilter={filter('company')}
        setCompanyFilter={setFilterValue('company')}
        companyOptions={companyOptionsQuery.data ?? []}
        companyLoading={companyOptionsQuery.isFetching}
        companyOnSearchChange={setCompanySearch}
        companySelectedLabel={selectedCompanyLabel}
        amFilter={filter('am')}
        setAmFilter={setFilterValue('am')}
        amOptions={amOptionsQuery.data ?? []}
        amLoading={amOptionsQuery.isFetching}
        amOnSearchChange={setAmSearch}
        amSelectedLabel={selectedAmLabel}
        currentUserRole={currentUser?.role}
        interviewDateFrom={filter('dateFrom')}
        setInterviewDateFrom={setFilterValue('dateFrom')}
        interviewDateTo={filter('dateTo')}
        setInterviewDateTo={setFilterValue('dateTo')}
        page={list.page}
        onPageChange={(page: number) => dispatch(setPage({ list: LISTS.interviews, page }))}
        pageSize={list.pageSize}
        onPageSizeChange={(pageSize: number) => dispatch(setPageSize({ list: LISTS.interviews, pageSize }))}
        total={interviewsQuery.data?.total ?? 0}
        totalPages={interviewsQuery.data?.totalPages ?? 1}
        setShowInterviewModal={openCreateInterview}
        openLifecycle={openLifecycle}
        onDeleteRequest={(item: Interview) => setDeletingInterview(item)}
        getInterviewStatusStyle={getInterviewStatusStyle}
        setSelectedInterview={setSelectedInterview}
        onEdit={openEditInterview}
        getInterviewActions={getInterviewActions}
        canScheduleInterview={canScheduleInterview}
        canBulkManageInterviews={canBulkManageInterviews}
      />

      {showInterviewModal && (
        <InterviewFormModal
          interviewForm={interviewForm}
          setInterviewForm={setInterviewForm}
          setShowInterviewModal={setShowInterviewModal}
          handleCreateInterview={handleCreateInterview}
          isSubmitting={createInterviewMutation.isPending}
        />
      )}

      {showEditInterviewModal && editingInterview && (
        <InterviewFormModal
          mode="edit"
          interviewForm={interviewForm}
          setInterviewForm={setInterviewForm}
          setShowInterviewModal={setShowEditInterviewModal}
          handleCreateInterview={handleUpdateInterview}
          initialDemandLabel={editingInterviewDemandLabel}
          initialCandidateLabel={editingInterviewCandidateLabel}
          initialRoundLabel={editingInterview.mode ? `${editingInterview.level} · ${editingInterview.mode}` : editingInterview.level}
          isSubmitting={updateInterviewMutation.isPending}
        />
      )}

      {selectedInterview && (
        <InterviewDetailModal
          selectedInterview={selectedInterview}
          setSelectedInterview={setSelectedInterview}
        />
      )}

      {deletingInterview && (
        <InterviewDeleteConfirmModal
          deletingInterview={deletingInterview}
          error={deleteInterviewError}
          onCancel={() => {
            setDeletingInterview(null);
            setDeleteInterviewError(null);
          }}
          onConfirm={(id: string) => {
            setDeleteInterviewError(null);
            deleteInterviewMutation.mutate(id, {
              onSuccess: () => setDeletingInterview(null),
              // 409 = blocked because the interview is still Scheduled; cancel it first. Shown
              // inline in the modal (not a native alert()) to match the rest of the app's UI.
              onError: (err) => {
                const msg = isAxiosError(err) ? (err.response?.data?.error as string | undefined) : undefined;
                setDeleteInterviewError(msg || 'Failed to remove interview');
                if (!msg) console.error('Error removing interview:', err);
              },
            });
          }}
          isDeleting={deleteInterviewMutation.isPending}
        />
      )}

      {overlays}
    </>
  );
}
