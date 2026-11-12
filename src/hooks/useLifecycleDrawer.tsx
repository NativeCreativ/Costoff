'use client';

import { useState } from 'react';
import { useLifecycleQuery } from '@/queries/lifecycle/useLifecycleQuery';
import {
  useBatchAssignCandidatesMutation,
  useUpdateSubmissionStageMutation,
} from '@/queries/lifecycle/useLifecycleMutations';
import { getRepoCandidates } from '@/services/lifecycle.service';
import { RequirementLifecycleDrawer } from '@/components/lifecycle/RequirementLifecycleDrawer';
import { CandidateBatchAssignModal } from '@/components/lifecycle/CandidateBatchAssignModal';

/**
 * Requirement-lifecycle drawer + candidate batch-assign modal.
 *
 * Both were previously declared inline in the single-page app and are opened from
 * more than one section (Interviews and Offers both call openLifecycle), so they are
 * encapsulated here and mounted by each route that needs them rather than being
 * duplicated per page.
 */
export function useLifecycleDrawer() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const lifecycleQuery = useLifecycleQuery(requestId, drawerOpen);

  const lifecycleDrawer = {
    open: drawerOpen,
    requestId,
    data: lifecycleQuery.data ?? null,
    loading: lifecycleQuery.isLoading,
  };

  const setLifecycleDrawer = (updater: any) => {
    const next = typeof updater === 'function' ? updater(lifecycleDrawer) : updater;
    setDrawerOpen(next.open);
    setRequestId(next.requestId);
  };

  const openLifecycle = (reqId: string) => {
    if (!reqId) return;
    setRequestId(reqId);
    setDrawerOpen(true);
  };

  const updateSubmissionStageMutation = useUpdateSubmissionStageMutation();
  const handleUpdateSubmissionStage = (submissionId: string, newStage: string) => {
    updateSubmissionStageMutation.mutate(
      { submissionId, stage: newStage },
      {
        onSuccess: () => {
          if (requestId) lifecycleQuery.refetch();
        },
      },
    );
  };

  /* ─────────────── CANDIDATE BATCH ASSIGN MODAL ─────────────── */
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    demandId: string | null;
    requestId: string | null;
    search: string;
    selectedCids: string[];
    loading: boolean;
    repoCandidates: any[];
    submitting: boolean;
  }>({
    open: false,
    demandId: null,
    requestId: null,
    search: '',
    selectedCids: [],
    loading: false,
    repoCandidates: [],
    submitting: false,
  });

  const batchAssignMutation = useBatchAssignCandidatesMutation();

  const openAssignModal = async (demandId: string, reqId: string) => {
    setAssignModal({
      open: true,
      demandId,
      requestId: reqId,
      search: '',
      selectedCids: [],
      loading: true,
      repoCandidates: [],
      submitting: false,
    });
    try {
      const repoCandidates = await getRepoCandidates();
      setAssignModal((prev) => ({ ...prev, loading: false, repoCandidates }));
    } catch (e) {
      console.error('Error fetching repo candidates:', e);
      setAssignModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleBatchAssignCandidates = () => {
    if (!assignModal.demandId || assignModal.selectedCids.length === 0) return;
    setAssignModal((prev) => ({ ...prev, submitting: true }));
    batchAssignMutation.mutate(
      { demandId: assignModal.demandId, candidateIds: assignModal.selectedCids },
      {
        onSuccess: () => {
          setAssignModal({
            open: false,
            demandId: null,
            requestId: null,
            search: '',
            selectedCids: [],
            loading: false,
            repoCandidates: [],
            submitting: false,
          });
          if (requestId) lifecycleQuery.refetch();
        },
        onError: () => {
          alert('Failed to assign candidates. Please try again.');
          setAssignModal((prev) => ({ ...prev, submitting: false }));
        },
      },
    );
  };

  /** The drawer + modal JSX, so each page just renders this once. */
  const overlays = (
    <>
      {lifecycleDrawer.open && (
        <RequirementLifecycleDrawer
          lifecycleDrawer={lifecycleDrawer}
          setLifecycleDrawer={setLifecycleDrawer}
          openAssignModal={openAssignModal}
          handleUpdateSubmissionStage={handleUpdateSubmissionStage}
          getInterviewStatusStyle={getInterviewStatusStyle}
        />
      )}
      {assignModal.open && (
        <CandidateBatchAssignModal
          assignModal={assignModal}
          setAssignModal={setAssignModal}
          handleBatchAssignCandidates={handleBatchAssignCandidates}
        />
      )}
    </>
  );

  return {
    openLifecycle,
    overlays,
  };
}

/** Shared status chip styling, used by the lifecycle drawer and history drawer. */
export function getInterviewStatusStyle(status: string) {
  const s = status?.toLowerCase() || '';
  if (s.includes('completed') || s.includes('done') || s.includes('cleared')) {
    return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', dot: '#10b981', label: 'Completed' };
  }
  if (s.includes('candidate no-show')) {
    return { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', dot: '#ef4444', label: 'Candidate No-Show' };
  }
  if (s.includes('client no-show')) {
    return { bg: '#fffbeb', text: '#d97706', border: '#fde68a', dot: '#f59e0b', label: 'Client No-Show' };
  }
  if (s.includes('rescheduled')) {
    return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', dot: '#8b5cf6', label: 'Rescheduled' };
  }
  if (s.includes('cancelled') || s.includes('canceled')) {
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8', label: 'Cancelled' };
  }
  return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', dot: '#3b82f6', label: 'Scheduled' };
}
