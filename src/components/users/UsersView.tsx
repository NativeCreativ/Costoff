'use client';

import { Eye, Pencil, Trash2, KeyRound } from 'lucide-react';
import { Profile } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { TableEmpty } from '@/components/ui/TableEmpty';
import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from '@/constants/options';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { formatDate, formatScheduledDate } from '@/lib/utils';

interface UsersViewProps {
  profiles: Profile[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  isFetching?: boolean;
  /** First-load only (no cached data yet) — the skeleton gate, so a background refetch
   *  (page/filter change while `keepPreviousData` still shows the prior rows) doesn't
   *  replace already-loaded rows with the skeleton. Mirrors Demands/Candidates/Interviews. */
  loadingUsers?: boolean;
  setShowUserModal: (v: boolean) => void;
  userSearch: string;
  setUserSearch: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  canManageUsers?: boolean;
  onView?: (item: Profile) => void;
  onEdit?: (item: Profile) => void;
  onDeleteRequest?: (item: Profile) => void;
  onChangePassword?: (item: Profile) => void;
}

const TABLE_COLUMNS = 8;
const TABLE_HEADER_HEIGHT = 41;
const TABLE_ROW_HEIGHT = 62;
const TABLE_VISIBLE_ROWS = 10;
const TABLE_AREA_HEIGHT = TABLE_HEADER_HEIGHT + TABLE_VISIBLE_ROWS * TABLE_ROW_HEIGHT;

export function UsersView({ profiles, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, isFetching, loadingUsers, setShowUserModal, userSearch, setUserSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter, canManageUsers, onView, onEdit, onDeleteRequest, onChangePassword }: UsersViewProps) {
  const skeletonRows = Math.max(1, Math.min(TABLE_VISIBLE_ROWS, pageSize));

  return (
    <>
      <div className="list-toolbar">
        <SearchInput
          value={userSearch}
          onDebouncedChange={setUserSearch}
          placeholder="Search by name, email, or phone..."
        />
        <div className="list-toolbar-row">
          <FilterSelect value={roleFilter} onChange={setRoleFilter} options={USER_ROLE_OPTIONS} allLabel="All Roles" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={USER_STATUS_OPTIONS} allLabel="All Statuses" />
          {canManageUsers && (
            <Button onClick={() => setShowUserModal(true)} className="toolbar-btn toolbar-btn-primary h-10">+ Add User</Button>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
        <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
          <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><span>System Users</span><Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">{total}</Badge></div>
        </div>
        <div className="table-scroll" style={{ minHeight: TABLE_AREA_HEIGHT }}>
          <table className="w-full text-left text-[0.83rem]">
            <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
              <tr>
                <th className="min-w-[160px] px-4 py-3">Full Name</th>
                <th className="min-w-[200px] px-4 py-3">Email</th>
                <th className="min-w-[130px] px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="min-w-[130px] px-4 py-3">Date of Joining</th>
                <th className="min-w-[130px] px-4 py-3">Created At</th>
                <th className="w-[150px] px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {loadingUsers ? (
                <TableSkeleton columns={TABLE_COLUMNS} rows={skeletonRows} rowMinHeight={TABLE_ROW_HEIGHT} padded />
              ) : profiles.length === 0 ? (
                <TableEmpty colSpan={TABLE_COLUMNS}>
                  No users found matching your search or filters.
                </TableEmpty>
              ) : (
                profiles.map(p => (
                <tr key={p.id} className="align-middle">
                  <td className="px-4 py-3 font-semibold text-[#0f172a]">{p.full_name}</td>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">{p.phone || '—'}</td>
                  <td className="px-4 py-3"><Badge className="rounded border-transparent bg-[#eff6ff] text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{p.role.toUpperCase()}</Badge></td>
                  <td className="px-4 py-3"><Badge className="rounded border-transparent bg-[#ecfdf5] text-[0.75rem] font-semibold text-[#10b981] hover:bg-[#ecfdf5]">{p.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">{p.date_of_joining ? formatScheduledDate(p.date_of_joining) : '—'}</td>
                  <td className="px-4 py-3">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        title="View User"
                        onClick={() => onView?.(p)}
                        className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#475569] hover:bg-white/80"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManageUsers && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            title="Edit User"
                            onClick={() => onEdit?.(p)}
                            className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#2563eb] hover:bg-white/80"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            title="Change Password"
                            onClick={() => onChangePassword?.(p)}
                            className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#7c3aed] hover:bg-white/80"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            title="Delete User"
                            onClick={() => onDeleteRequest?.(p)}
                            className="h-8 w-8 rounded-md border-[#fee2e2] bg-[#fff5f5] text-[#dc2626] hover:bg-[#fff5f5]/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[color:var(--card-border)] px-[22px] py-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            total={total}
            itemLabel="users"
          />
        </div>
      </div>
    </>
  );
}
