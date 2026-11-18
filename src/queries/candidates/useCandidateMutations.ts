import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { queryKeys } from '@/lib/queryKeys';
import { createCandidate, updateCandidate, deleteCandidate, bulkDeleteCandidates, DuplicateCandidateError, uploadCandidateFile, type CandidateFileKind } from '@/services/candidate.service';
import { useToast } from '@/components/ui/Toast';
import { CandidateFormState } from '@/components/candidates/CandidateFormModal';

export function getDuplicateCandidateError(err: unknown): DuplicateCandidateError | null {
  if (isAxiosError(err) && err.response?.data?.isDuplicate) {
    return err.response.data as DuplicateCandidateError;
  }
  return null;
}

export function useCreateCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // requestId carries the demand context. Recruiters must supply one (the API
    // returns 403 otherwise); AMs/Super Admins may omit it to create in the master pool.
    mutationFn: ({ form, requestId }: { form: CandidateFormState; requestId?: string }) =>
      createCandidate(form, requestId),    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: CandidateFormState }) => updateCandidate(id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useBulkDeleteCandidatesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateIds: string[]) => bulkDeleteCandidates(candidateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/** Uploads a candidate resume / photo / RTR file. Nothing is cached: the form keeps the url. */
export function useUploadCandidateFileMutation() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ kind, file }: { kind: CandidateFileKind; file: File }) => uploadCandidateFile(kind, file),
    onError: (err: any) => {
      toast.error('Upload Failed', err?.response?.data?.error || err?.message || 'Failed to upload the file');
    },
  });
}
