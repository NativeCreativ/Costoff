import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  assignDemand,
  changeDemandStatus,
  bulkChangeDemandStatus,
  bulkDeleteDemands,
  closeDemand,
  addDemandCandidate,
  changeSubmissionStatus,
  addSubmissionEvent,
  scheduleInterview,
  updateInterview,
  updateOnboarding,
  uploadOnboardingDocument,
  uploadOnboardingDocumentFile,
  updateSuperAdminSettings,
  toggleOnboardingDocument,
  toggleBgvChecklistItem,
  reviewSourcedProfile,
  type AssignDemandPayload,
  type AddDemandCandidatePayload,
  type AddSubmissionEventPayload,
  type ScheduleInterviewPayload,
  type UpdateInterviewPayload,
  type UpdateOnboardingPayload,
} from '@/services/demandFulfillment.service';
import type { SuperAdminSettingsPatch } from '@/components/types';
import { useToast } from '@/components/ui/Toast';

async function invalidateDemand(queryClient: ReturnType<typeof useQueryClient>, requestId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['demands'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) }),
  ]);
}

export function useAssignDemandMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignDemandPayload) => assignDemand(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.demandAssignments(requestId) }),
        invalidateDemand(queryClient, requestId),
      ]);
    },
  });
}

export function useChangeDemandStatusMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ to_status, remark }: { to_status: string; remark?: string }) => changeDemandStatus(requestId, to_status, remark),
    onSuccess: () => {
      invalidateDemand(queryClient, requestId);
      queryClient.invalidateQueries({ queryKey: queryKeys.demandStatusEvents(requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
    },
  });
}

export function useBulkChangeDemandStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandIds, to_status, remark }: { demandIds: string[]; to_status: string; remark: string }) =>
      bulkChangeDemandStatus(demandIds, to_status, remark),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}

export function useBulkDeleteDemandsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (demandIds: string[]) => bulkDeleteDemands(demandIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}

export function useCloseDemandMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ closure_feedback, remark }: { closure_feedback: string; remark?: string }) => closeDemand(requestId, closure_feedback, remark),
    onSuccess: () => {
      invalidateDemand(queryClient, requestId);
      queryClient.invalidateQueries({ queryKey: queryKeys.demandStatusEvents(requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
    },
  });
}

export function useAddDemandCandidateMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddDemandCandidatePayload) => addDemandCandidate(requestId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidates(requestId) });
      invalidateDemand(queryClient, requestId);
    },
  });
}

export function useChangeSubmissionStatusMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dcId, to_status, remark }: { dcId: string; to_status: string; remark?: string }) =>
      changeSubmissionStatus(requestId, dcId, to_status, remark),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidates(requestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidateDetail(requestId, variables.dcId) });
      invalidateDemand(queryClient, requestId);
    },
  });
}

export function useAddSubmissionEventMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dcId, payload }: { dcId: string; payload: AddSubmissionEventPayload }) => addSubmissionEvent(requestId, dcId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidateDetail(requestId, variables.dcId) });
    },
  });
}

export function useScheduleInterviewMutation(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dcId, payload }: { dcId: string; payload: ScheduleInterviewPayload }) => scheduleInterview(requestId, dcId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidateDetail(requestId, variables.dcId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidates(requestId) });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      // The Interviews & Schedules list (useInterviewsQuery) reads its own ['interviews', filters]
      // key — this must be invalidated too, or a slot scheduled from the candidate panel only
      // shows up there after a hard refresh.
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateInterviewMutation(requestId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ interviewId, payload }: { interviewId: string; payload: UpdateInterviewPayload }) => updateInterview(interviewId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'interviews'] });
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['demands', requestId] });
      }
    },
  });
}

export function useUpdateOnboardingMutation(requestId: string, dcId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ onboardingId, payload }: { onboardingId: string; payload: UpdateOnboardingPayload }) => updateOnboarding(onboardingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandOnboarding(requestId, dcId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidateDetail(requestId, dcId) });
      invalidateDemand(queryClient, requestId);
    },
  });
}

export function useUploadOnboardingDocumentFileMutation(requestId: string, dcId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ onboardingId, name, file }: { onboardingId: string; name: string; file: File }) =>
      uploadOnboardingDocumentFile(onboardingId, name, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandOnboarding(requestId, dcId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) });
    },
  });
}

export function useUploadOnboardingDocumentMutation(requestId: string, dcId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ onboardingId, name, url, remark }: { onboardingId: string; name: string; url: string; remark?: string }) =>
      uploadOnboardingDocument(onboardingId, name, url, remark),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.demandOnboarding(requestId, dcId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidateDetail(requestId, dcId) });
    },
  });
}

// Called by every Demand Fulfillment Settings tab (resume cap, default interview rounds,
// interview modes, onboarding/BGV checklists) once per user action, each sending only the one
// field it owns — see `SuperAdminSettingsPatch`. Compensation and Skills Library are not wired
// through this mutation; they already have their own per-entity CRUD mutations.
export function useUpdateSuperAdminSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SuperAdminSettingsPatch) => updateSuperAdminSettings(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.superAdminSettingsDF }),
  });
}

export function useToggleOnboardingDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, isActive }: { name: string; isActive: boolean }) => toggleOnboardingDocument(name, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminSettingsDF });
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminSettingsDFIncludeInactive });
    },
  });
}

export function useToggleBgvChecklistItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, isActive }: { name: string; isActive: boolean }) => toggleBgvChecklistItem(name, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminSettingsDF });
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminSettingsDFIncludeInactive });
    },
  });
}

/** Sourcing review: Submit / Submit as Active / Approve / Reject. Refreshes the pipeline. */
export function useReviewSourcedProfileMutation(requestId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ dcId, action, remark }: { dcId: string; action: 'submit' | 'submit_as_active' | 'approve' | 'reject'; remark?: string }) =>
      reviewSourcedProfile(requestId, dcId, { action, remark }),
    onSuccess: (_data, vars) => {
      const done = { submit: 'Submitted for review', submit_as_active: 'Submitted as Active', approve: 'Approved — moved to Shortlist', reject: 'Rejected — sent back to the recruiter' };
      toast.success(done[vars.action]);
      return queryClient.invalidateQueries({ queryKey: ['demands', requestId] });
    },
    onError: (err: any) => toast.error('Action failed', err?.response?.data?.error || err?.message || 'Please try again'),
  });
}
