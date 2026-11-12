import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseCompanyImportFile, bulkImportCompanies } from '@/services/companyImport.service';
import type { CompanyImportFieldKey } from '@/constants/companyImportFields';

export function useParseCompanyImportMutation() {
  return useMutation({
    mutationFn: (file: File) => parseCompanyImportFile(file),
  });
}

export function useBulkImportCompaniesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mapping, rows }: { mapping: Partial<Record<CompanyImportFieldKey, string>>; rows: Record<string, string>[] }) =>
      bulkImportCompanies(mapping, rows),
    onSuccess: () => {
      // Refresh the list (a new row may have been created) and the dashboard, which counts
      // companies.
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}