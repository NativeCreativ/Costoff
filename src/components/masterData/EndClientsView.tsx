'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { COMPANY_STATUS_OPTIONS } from '@/constants/options';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { useEndClientsQuery } from '@/queries/endClients/useEndClients';
import { EndClientFormModal } from './EndClientFormModal';
import type { EndClient } from '@/services/endClient.service';

export function EndClientsView() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<EndClient | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useEndClientsQuery({ search, status, page, pageSize });
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onDebouncedChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search end client, location…" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
            allLabel="All statuses"
            options={COMPANY_STATUS_OPTIONS}
          />
          <Button type="button" onClick={() => setCreating(true)}>+ Add End Client</Button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="w-full text-left text-[0.83rem]">
          <thead className="border-b border-[#e2e8f0] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">SPOCs</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Demands</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <TableSkeleton columns={7} rows={6} padded />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#64748b]">No end clients yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9]">
                  <td className="px-3 py-2 font-semibold text-[#0f172a]">{row.name}</td>
                  <td className="px-3 py-2 text-[#475569]">{row.location || '—'}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-[#475569]">{row.description || '—'}</td>
                  <td className="px-3 py-2 text-[#475569]">
                    {(row.end_client_spocs ?? []).map((spoc) => spoc.name).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={row.status === 'ACTIVE' ? 'border-transparent bg-[#dcfce7] text-[#166534]' : 'border-transparent bg-[#f1f5f9] text-[#64748b]'}>
                      {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{row._count?.demands ?? 0}</td>
                  <td className="px-3 py-2">
                    <button type="button" aria-label={`Edit ${row.name}`} className="text-[#64748b] hover:text-[#2563eb]" onClick={() => setEditing(row)}>
                      <Pencil className="h-4 w-4" />
                    </button>
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
      {creating && <EndClientFormModal onClose={() => setCreating(false)} />}
      {editing && <EndClientFormModal client={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
