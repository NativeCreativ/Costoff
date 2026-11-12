'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/Toast';
import { createTodo, deleteTodo, getTodos, quickUpdateTodo, updateTodo } from '@/services/teamWork.service';
import type { TodoValues, TodoView } from '@/components/teamWork/teamWork.schema';

export function useTodosQuery(view: TodoView, page = 1) {
  return useQuery({
    queryKey: queryKeys.todos(view, page),
    queryFn: () => getTodos(view, page),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  });
}

/** Every To-Do write refreshes all views (an item can move between active / mine / past). */
function useTodoMutation<TVars>(fn: (vars: TVars) => Promise<unknown>, failTitle: string, failText: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
    onError: (err: any) => {
      console.error(`Error: ${failText}`, err);
      toast.error(failTitle, err?.response?.data?.error || err?.message || failText);
    },
  });
}

export const useCreateTodoMutation = () =>
  useTodoMutation((values: TodoValues) => createTodo(values), 'Save Failed', 'Failed to save the To-Do item');
export const useUpdateTodoMutation = () =>
  useTodoMutation(({ id, values }: { id: string; values: TodoValues }) => updateTodo(id, values), 'Update Failed', 'Failed to update the To-Do item');
export const useQuickUpdateTodoMutation = () =>
  useTodoMutation(
    ({ id, patch }: { id: string; patch: { status?: string; is_published?: boolean } }) => quickUpdateTodo(id, patch),
    'Update Failed',
    'Failed to update the To-Do item'
  );
export const useDeleteTodoMutation = () =>
  useTodoMutation((id: string) => deleteTodo(id), 'Delete Failed', 'Failed to delete the To-Do item');
