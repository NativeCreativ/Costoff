import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { parseCandidateImportFile, bulkImportCandidates } from '@/services/candidateImport.service';
import type { CandidateImportFieldKey } from '@/constants/candidateImportFields';

export function useParseCandidateImportMutation() {
  return useMutation({
    mutationFn: (file: File) => parseCandidateImportFile(file),
  });
}

export function useBulkImportCandidatesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mapping, rows }: { mapping: Partial<Record<CandidateImportFieldKey, string>>; rows: Record<string, string>[] }) =>
      bulkImportCandidates(mapping, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
