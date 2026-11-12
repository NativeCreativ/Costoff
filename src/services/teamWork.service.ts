import { api } from '@/lib/axios';
import type { PaginatedResult } from '@/lib/pagination';
import type { TaskLogValues, TodoValues, TodoView } from '@/components/teamWork/teamWork.schema';

export interface TaskLog {
  id: string;
  user_id: string;
  user_name: string | null;
  task_name: string;
  details: string | null;
  start_date: string;
  end_date: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodoItem {
  id: string;
  title: string;
  details: string | null;
  priority: string;
  active_from: string;
  active_until: string;
  status: string;
  is_published: boolean;
  published_at: string | null;
  created_by: string;
  created_by_name: string | null;
  created_by_role: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskLogFilters {
  from?: string;
  to?: string;
  userId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function compact(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
}

export async function getTaskLogs(filters: TaskLogFilters = {}): Promise<PaginatedResult<TaskLog> & { can_view_all: boolean }> {
  const { data } = await api.get('/task-logs', { params: compact({ ...filters }) });
  return {
    data: data.taskLogs ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
    totalPages: data.totalPages ?? 1,
    can_view_all: !!data.can_view_all,
  };
}

export async function createTaskLog(values: TaskLogValues): Promise<TaskLog> {
  const { data } = await api.post('/task-logs', values);
  return data.taskLog;
}

export async function updateTaskLog(id: string, values: TaskLogValues): Promise<TaskLog> {
  const { data } = await api.put(`/task-logs/${encodeURIComponent(id)}`, values);
  return data.taskLog;
}

export async function deleteTaskLog(id: string): Promise<void> {
  await api.delete(`/task-logs/${encodeURIComponent(id)}`);
}

export async function getTodos(view: TodoView, page = 1, pageSize = 50): Promise<PaginatedResult<TodoItem> & { can_create: boolean; today: string }> {
  const { data } = await api.get('/todos', { params: { view, page, pageSize } });
  return {
    data: data.todos ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? pageSize,
    totalPages: data.totalPages ?? 1,
    can_create: !!data.can_create,
    today: data.today ?? '',
  };
}

export async function createTodo(values: TodoValues): Promise<TodoItem> {
  const { data } = await api.post('/todos', values);
  return data.todo;
}

export async function updateTodo(id: string, values: TodoValues): Promise<TodoItem> {
  const { data } = await api.put(`/todos/${encodeURIComponent(id)}`, values);
  return data.todo;
}

export async function quickUpdateTodo(id: string, patch: { status?: string; is_published?: boolean }): Promise<TodoItem> {
  const { data } = await api.patch(`/todos/${encodeURIComponent(id)}`, patch);
  return data.todo;
}

export async function deleteTodo(id: string): Promise<void> {
  await api.delete(`/todos/${encodeURIComponent(id)}`);
}
