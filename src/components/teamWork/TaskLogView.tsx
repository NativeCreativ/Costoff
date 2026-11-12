'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { MoreLessText } from '@/components/ui/MoreLessText';
import { InlineDeleteConfirm } from '@/components/ui/InlineDeleteConfirm';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { formatScheduledDate } from '@/lib/utils';
import { useTaskLogsQuery, useDeleteTaskLogMutation } from '@/queries/teamWork/useTaskLogs';
import { useUsersQuery } from '@/queries/users/useUsersQuery';
import { TaskLogFormModal } from './TaskLogFormModal';
import type { TaskLog } from '@/services/teamWork.service';

/**
 * Task Log: what each person worked on. Everyone sees and edits their own tasks; the Delivery
 * Head sees everyone's and can filter by person (the API decides — `can_view_all`).
 */
export function TaskLogView() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<TaskLog | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const query = useTaskLogsQuery({ search, from, to, userId, page, pageSize });
  const remove = useDeleteTaskLogMutation();
  const canViewAll = !!query.data?.can_view_all;
  // Only the Delivery Head gets the person filter (and may read the user list).
  const usersQuery = useUsersQuery({ pageSize: 100 }, { enabled: canViewAll });
  const rows = query.data?.data ?? [];
  const columns = canViewAll ? 6 : 5;
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <SearchInput value={search} onDebouncedChange={resetPage(setSearch)} placeholder="Search task, details, remarks…" />
          <label className="flex flex-col text-[0.72rem] font-semibold text-[#64748b]">
            From
            <Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} />
          </label>
          <label className="flex flex-col text-[0.72rem] font-semibold text-[#64748b]">
            To
            <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
          </label>
          {canViewAll && (
            <FilterSelect
              value={userId}
              onChange={resetPage(setUserId)}
              allLabel="Everyone"
              options={(usersQuery.data?.data ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
            />
          )}
        </div>
        <Button type="button" onClick={() => setCreating(true)}>+ Log a Task</Button>
      </div>

      <div className="table-scroll">
        <table className="w-full text-left text-[0.83rem]">
          <thead className="border-b border-[#e2e8f0] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
            <tr>
              <th className="px-3 py-2">Dates</th>
              {canViewAll && <th className="px-3 py-2">Person</th>}
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <TableSkeleton columns={columns} rows={6} padded />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns} className="px-3 py-8 text-center text-[#64748b]">
                  No tasks logged{from || to || search ? ' for these filters' : ' yet'}.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9] align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[#475569]">
                    {formatScheduledDate(row.start_date)}
                    {row.end_date && row.end_date !== row.start_date && <> – {formatScheduledDate(row.end_date)}</>}
                    {!row.end_date && <span className="ml-1 rounded bg-[#eff6ff] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[#1d4ed8]">Ongoing</span>}
                  </td>
                  {canViewAll && <td className="whitespace-nowrap px-3 py-2 text-[#334155]">{row.user_name || '—'}</td>}
                  <td className="px-3 py-2 font-semibold text-[#0f172a]">{row.task_name}</td>
                  <td className="max-w-[320px] px-3 py-2 text-[#475569]">
                    {row.details ? <MoreLessText text={row.details} wordLimit={25} charLimit={180} /> : '—'}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-[#475569]">
                    {row.remarks ? <MoreLessText text={row.remarks} wordLimit={20} charLimit={140} /> : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Edit ${row.task_name}`} className="text-[#64748b] hover:text-[#2563eb]" onClick={() => setEditing(row)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <InlineDeleteConfirm
                        isConfirming={confirmingId === row.id}
                        onDeleteRequest={() => setConfirmingId(row.id)}
                        onCancel={() => setConfirmingId(null)}
                        onConfirm={() => remove.mutate(row.id, { onSettled: () => setConfirmingId(null) })}
                        disabled={remove.isPending}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={query.data?.totalPages ?? 1}
        total={query.data?.total ?? 0}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
      {creating && <TaskLogFormModal onClose={() => setCreating(false)} />}
      {editing && <TaskLogFormModal task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
