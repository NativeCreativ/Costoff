'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import { createTaskLog, deleteTaskLog, getTaskLogs, updateTaskLog, type TaskLogFilters } from '@/services/teamWork.service';
import type { TaskLogValues } from '@/components/teamWork/teamWork.schema';

export function useTaskLogsQuery(filters: TaskLogFilters) {
  return useQuery({
    queryKey: queryKeys.taskLogs(filters),
    queryFn: () => getTaskLogs(filters),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  });
}

function useTaskLogMutation<TVars>(fn: (vars: TVars) => Promise<unknown>, failTitle: string, failText: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-logs'] }),
    onError: (err: any) => {
      console.error(`Error: ${failText}`, err);
      toast.error(failTitle, err?.response?.data?.error || err?.message || failText);
    },
  });
}

export const useCreateTaskLogMutation = () =>
  useTaskLogMutation((values: TaskLogValues) => createTaskLog(values), 'Save Failed', 'Failed to save the task');
export const useUpdateTaskLogMutation = () =>
  useTaskLogMutation(({ id, values }: { id: string; values: TaskLogValues }) => updateTaskLog(id, values), 'Update Failed', 'Failed to update the task');
export const useDeleteTaskLogMutation = () =>
  useTaskLogMutation((id: string) => deleteTaskLog(id), 'Delete Failed', 'Failed to delete the task');
