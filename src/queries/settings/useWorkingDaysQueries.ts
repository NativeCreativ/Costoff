import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getWorkingDays, saveWorkingDay, type SaveWorkingDayInput } from '@/services/workingDays.service';

export function useWorkingDaysQuery(year: number) {
  return useQuery({
    queryKey: queryKeys.workingDays(year),
    queryFn: () => getWorkingDays(year),
    staleTime: 60 * 1000,
  });
}

export function useSaveWorkingDayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWorkingDayInput) => saveWorkingDay(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workingDays(variables.year) });
    },
  });
}
