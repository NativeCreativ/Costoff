'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import {
  getOnboardingSteps,
  getOnboardingStepTemplates,
  saveOnboardingStepTemplates,
  updateOnboardingStep,
  uploadOnboardingStepFile,
  type OnboardingStepTemplate,
} from '@/services/demandFulfillment.service';

const STALE_TIME_MS = 30 * 1000;

/** A step as the settings editor sends it: an existing row (id) or a new one (no id). */
export type OnboardingStepTemplateDraft = Pick<OnboardingStepTemplate, 'name'> &
  Partial<Pick<OnboardingStepTemplate, 'details' | 'requires_attachment' | 'is_active'>> & { id?: string | null };

export function useOnboardingStepsQuery(onboardingId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.onboardingSteps(onboardingId ?? ''),
    queryFn: () => getOnboardingSteps(onboardingId as string),
    enabled: !!onboardingId,
    staleTime: STALE_TIME_MS,
  });
}

/** Step updates also land in the demand's change log, so that is refreshed too. */
function useInvalidateSteps(onboardingId: string, requestId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingSteps(onboardingId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.demandChangeLog(requestId) }),
    ]);
}

export function useUpdateOnboardingStepMutation(onboardingId: string, requestId: string) {
  const invalidate = useInvalidateSteps(onboardingId, requestId);
  const toast = useToast();
  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: { status?: string; remark?: string | null; clear_attachment?: boolean } }) =>
      updateOnboardingStep(onboardingId, stepId, payload),
    onSuccess: invalidate,
    onError: (err: any) => {
      console.error('Error updating onboarding step:', err);
      toast.error('Update Failed', err?.response?.data?.error || err?.message || 'Failed to update the step');
    },
  });
}

export function useUploadOnboardingStepFileMutation(onboardingId: string, requestId: string) {
  const invalidate = useInvalidateSteps(onboardingId, requestId);
  const toast = useToast();
  return useMutation({
    mutationFn: ({ stepId, file }: { stepId: string; file: File }) => uploadOnboardingStepFile(onboardingId, stepId, file),
    onSuccess: invalidate,
    onError: (err: any) => {
      console.error('Error uploading onboarding step file:', err);
      toast.error('Upload Failed', err?.response?.data?.error || err?.message || 'Failed to upload the document');
    },
  });
}

/** Settings editor: one client's list ('default' = the default list). */
export function useOnboardingStepTemplatesQuery(companyId: string | null) {
  return useQuery({
    queryKey: queryKeys.onboardingStepTemplates(companyId ?? 'default'),
    queryFn: () => getOnboardingStepTemplates(companyId),
    staleTime: STALE_TIME_MS,
    refetchOnMount: 'always',
  });
}

export function useSaveOnboardingStepTemplatesMutation(companyId: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (steps: OnboardingStepTemplateDraft[]) => saveOnboardingStepTemplates(companyId, steps),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.onboardingStepTemplates(companyId ?? 'default'), result);
    },
    onError: (err: any) => {
      console.error('Error saving onboarding steps:', err);
      toast.error('Save Failed', err?.response?.data?.error || err?.message || 'Failed to save the onboarding steps');
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStepTemplates(companyId ?? 'default') });
    },
  });
}
