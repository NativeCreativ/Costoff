'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { MoreLessText } from '@/components/ui/MoreLessText';
import { InlineDeleteConfirm } from '@/components/ui/InlineDeleteConfirm';
import { cn, formatScheduledDate } from '@/lib/utils';
import { canManageTodo } from '@/lib/auth/teamWorkPermissions';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { useDeleteTodoMutation, useQuickUpdateTodoMutation, useTodosQuery } from '@/queries/teamWork/useTodos';
import { todoTiming, type TodoView } from './teamWork.schema';
import { TodoFormModal } from './TodoFormModal';
import type { TodoItem } from '@/services/teamWork.service';

const VIEW_LABELS: Record<TodoView, string> = {
  active: 'Active today',
  upcoming: 'Upcoming',
  past: 'Past',
  mine: 'My items',
};

const PRIORITY_CLASSES: Record<string, string> = {
  High: 'bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fef2f2]',
  Medium: 'bg-[#fffbeb] text-[#92400e] hover:bg-[#fffbeb]',
  Low: 'bg-[#f1f5f9] text-[#475569] hover:bg-[#f1f5f9]',
};

/**
 * To-Do List. Everyone sees published items in their active period; AMs, SPOCs and the
 * Delivery Head write them (drafts stay private under "My items") and are the only ones who
 * can edit, publish, complete or delete their own items.
 */
export function TodoListView() {
  const [view, setView] = useState<TodoView>('active');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const query = useTodosQuery(view, page);
  const quick = useQuickUpdateTodoMutation();
  const remove = useDeleteTodoMutation();
  const me = useCurrentUserQuery().data;
  const actor = { role: me?.role, id: me?.id };
  const canCreate = !!query.data?.can_create;
  const items = query.data?.data ?? [];
  const views = (Object.keys(VIEW_LABELS) as TodoView[]).filter((v) => v !== 'mine' || canCreate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-[#e2e8f0] bg-white p-0.5" role="tablist" aria-label="To-Do views">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => { setView(v); setPage(1); }}
              className={cn('rounded px-3 py-1.5 text-[0.8rem] font-medium', view === v ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'text-[#475569] hover:bg-[#f8fafc]')}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        {canCreate && <Button type="button" onClick={() => setCreating(true)}>+ New To-Do</Button>}
      </div>

      {query.isLoading ? (
        <Loader message="Loading the To-Do list…" />
      ) : query.isError ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the To-Do list.</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">
          {view === 'active' ? 'Nothing on the To-Do list today.' : view === 'mine' ? 'You have not written any To-Do items yet.' : `No ${VIEW_LABELS[view].toLowerCase()} items.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const manageable = canManageTodo(actor, item);
            const isDone = item.status === 'done';
            const timing = todoTiming(item, query.data?.today);
            return (
              <li key={item.id} className={cn('rounded-lg border border-[#e2e8f0] bg-white p-3', isDone && 'bg-[#f8fafc]')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {isDone ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#cbd5e1]" />}
                    <div className="min-w-0">
                      <div className={cn('text-[0.88rem] font-semibold text-[#0f172a]', isDone && 'text-[#64748b] line-through')}>{item.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-[#64748b]">
                        <Badge className={cn('border-transparent text-[0.68rem] font-semibold', PRIORITY_CLASSES[item.priority] ?? PRIORITY_CLASSES.Low)}>{item.priority}</Badge>
                        <span>
                          {formatScheduledDate(item.active_from)} – {formatScheduledDate(item.active_until)}
                        </span>
                        {view === 'mine' && (
                          <span className="font-semibold">
                            · {item.is_published ? (timing === 'active' ? 'Live' : timing === 'upcoming' ? 'Scheduled' : 'Expired') : 'Draft'}
                          </span>
                        )}
                        {item.created_by_name && <span>· by {item.created_by_name}</span>}
                      </div>
                      {item.details && (
                        <div className="mt-1 text-[0.8rem] text-[#475569]">
                          <MoreLessText text={item.details} wordLimit={40} charLimit={260} />
                        </div>
                      )}
                    </div>
                  </div>
                  {manageable && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={quick.isPending}
                        onClick={() => quick.mutate({ id: item.id, patch: { status: isDone ? 'open' : 'done' } })}
                      >
                        {isDone ? 'Reopen' : 'Mark done'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={quick.isPending}
                        onClick={() => quick.mutate({ id: item.id, patch: { is_published: !item.is_published } })}
                      >
                        {item.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <button type="button" aria-label={`Edit ${item.title}`} className="px-1 text-[#64748b] hover:text-[#2563eb]" onClick={() => setEditing(item)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <InlineDeleteConfirm
                        isConfirming={confirmingId === item.id}
                        onDeleteRequest={() => setConfirmingId(item.id)}
                        onCancel={() => setConfirmingId(null)}
                        onConfirm={() => remove.mutate(item.id, { onSettled: () => setConfirmingId(null) })}
                        disabled={remove.isPending}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(query.data?.totalPages ?? 1) > 1 && (
        <Pagination
          page={page}
          totalPages={query.data?.totalPages ?? 1}
          total={query.data?.total ?? 0}
          pageSize={query.data?.pageSize ?? 50}
          onPageChange={setPage}
        />
      )}
      {creating && <TodoFormModal onClose={() => setCreating(false)} />}
      {editing && <TodoFormModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
