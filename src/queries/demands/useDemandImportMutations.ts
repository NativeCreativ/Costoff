import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { parseDemandImportFile, bulkImportDemands } from '@/services/demandImport.service';
import type { DemandImportFieldKey } from '@/constants/demandImportFields';

export function useParseDemandImportMutation() {
  return useMutation({
    mutationFn: (file: File) => parseDemandImportFile(file),
  });
}

export function useBulkImportDemandsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mapping, rows }: { mapping: Partial<Record<DemandImportFieldKey, string>>; rows: Record<string, string>[] }) =>
      bulkImportDemands(mapping, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
