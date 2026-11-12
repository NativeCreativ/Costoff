'use client';

import { useMemo, useState } from 'react';
import { Demand } from '../types';
import { DemandsTable } from './DemandsTable';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { DEMAND_STATUS_OPTIONS, PRIORITY_OPTIONS, ROLE_CATEGORY_OPTIONS } from '@/constants/options';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { BulkDemandStatusModal } from '@/components/demandFulfillment/BulkDemandStatusModal';
import { BulkDemandDeleteModal } from '@/components/demandFulfillment/BulkDemandDeleteModal';
import { DemandImportModal } from './DemandImportModal';
import { DownloadMenu } from '@/components/bulk/DownloadMenu';
import { getDemandExportUrl, getDemandImportTemplateUrl } from '@/services/demandImport.service';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface DemandsViewProps {
  demands: Demand[];
  loadingDemands: boolean;
  isFetching?: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  demandSearch: string;
  setDemandSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  roleTypeFilter: string;
  setRoleTypeFilter: (v: string) => void;
  redFlagsOnly: boolean;
  setRedFlagsOnly: (v: boolean) => void;
  /** Recruiters only: "My demands" vs every demand. */
  showAssignedToMeToggle?: boolean;
  assignedToMe?: boolean;
  setAssignedToMe?: (v: boolean) => void;
  setShowDemandModal: (v: boolean) => void;
  canManageDemands?: boolean;
  canManageDemandsLoading?: boolean;
  getDemandPermissions: (item: Demand) => { canEdit: boolean; canDelete: boolean; canClone: boolean; deleteDisabledReason?: string };
  openLifecycle: (reqId: string) => void;
  onEdit: (item: Demand) => void;
  onDeleteRequest: (item: Demand) => void;
  onCloneRequest: (item: Demand) => void;
  /** AM / Super Admin only — enables row checkboxes + "Bulk Status Change" on this page. */
  canBulkChangeStatus?: boolean;
}

export function DemandsView({
  demands, loadingDemands, isFetching, total, page, totalPages, onPageChange, pageSize, onPageSizeChange,
  demandSearch, setDemandSearch, statusFilter, setStatusFilter,
  priorityFilter, setPriorityFilter, roleTypeFilter, setRoleTypeFilter, redFlagsOnly, setRedFlagsOnly,
  showAssignedToMeToggle, assignedToMe, setAssignedToMe,
  setShowDemandModal, canManageDemands, canManageDemandsLoading, getDemandPermissions, openLifecycle, onEdit, onDeleteRequest, onCloneRequest,
  canBulkChangeStatus,
}: DemandsViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const exportFilters = { search: demandSearch, status: statusFilter, priority: priorityFilter, roleType: roleTypeFilter, redFlagsOnly, assignedToMe };

  const demandLabels = useMemo(() => Object.fromEntries(demands.map((d) => [d.id, d.request_id])), [demands]);
  const demandsById = useMemo(() => Object.fromEntries(demands.map((d) => [d.id, d])), [demands]);

  const toggleSelect = (item: Demand) => {
    setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
  };
  const toggleSelectAll = (allIds: string[]) => {
    setSelectedIds((prev) => (allIds.every((id) => prev.includes(id)) ? prev.filter((id) => !allIds.includes(id)) : [...new Set([...prev, ...allIds])]));
  };

  return (
    <>
      <div className="list-toolbar">
        <SearchInput
          value={demandSearch}
          onDebouncedChange={setDemandSearch}
          placeholder="Search company, client, job title, skills..."
        />
        <div className="list-toolbar-row">
          {showAssignedToMeToggle && (
            // The empty ("default") entry is My demands; the one other choice is every demand.
            <FilterSelect
              value={assignedToMe ? '' : 'all'}
              onChange={(v) => setAssignedToMe?.(v !== 'all')}
              options={[{ value: 'all', label: 'All demands' }]}
              allLabel="My demands"
            />
          )}
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={DEMAND_STATUS_OPTIONS} allLabel="All Statuses" />
          <FilterSelect value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} allLabel="All Priorities" />
          <FilterSelect value={roleTypeFilter} onChange={setRoleTypeFilter} options={ROLE_CATEGORY_OPTIONS} allLabel="All Role Types" />
          <button
            type="button"
            onClick={() => setRedFlagsOnly(!redFlagsOnly)}
            className={`toolbar-btn toolbar-btn-flag ${redFlagsOnly ? 'is-on' : ''}`}
            aria-pressed={redFlagsOnly}
          >
            <i className="fa-solid fa-flag"></i>Red Flags Only (&gt; 30 Days)
          </button>
          <Popover open={exportMenuOpen} onOpenChange={setExportMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="toolbar-btn">
                <i className="fa-solid fa-download"></i>Export
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1">
              <a
                href={getDemandExportUrl('xlsx', exportFilters)}
                download
                onClick={() => setExportMenuOpen(false)}
                className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
              >
                Export Excel (.xlsx)
              </a>
              <a
                href={getDemandExportUrl('csv', exportFilters)}
                download
                onClick={() => setExportMenuOpen(false)}
                className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
              >
                Export CSV (.csv)
              </a>
            </PopoverContent>
          </Popover>
          {canManageDemandsLoading ? (
            <div className="h-[38px] w-[150px] animate-pulse rounded-md bg-[#e2e8f0]" />
          ) : (
            canManageDemands && (
              <>
                <DownloadMenu
                  label="Download Template"
                  title="Download a blank template with the expected columns"
                  items={[
                    { label: 'Template (.xlsx)', href: getDemandImportTemplateUrl('xlsx') },
                    { label: 'Template (.csv)', href: getDemandImportTemplateUrl('csv') },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="toolbar-btn"
                >
                  <i className="fa-solid fa-upload"></i>Import Demands
                </button>
                <button type="button" onClick={() => setShowDemandModal(true)} className="toolbar-btn toolbar-btn-primary">+ Add New Demand</button>
              </>
            )
          )}
        </div>
      </div>

      <DemandsTable
        demands={demands}
        loadingDemands={loadingDemands}
        isFetching={isFetching}
        getDemandPermissions={getDemandPermissions}
        openLifecycle={openLifecycle}
        onEdit={onEdit}
        onDeleteRequest={onDeleteRequest}
        onCloneRequest={onCloneRequest}
        bulkSelectable={canBulkChangeStatus}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onBulkStatusChange={() => setShowBulkModal(true)}
        onBulkDelete={() => setShowBulkDeleteModal(true)}
      />

      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white px-[22px] py-4 shadow-[var(--card-shadow)]">
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          total={total}
          itemLabel="demands"
        />
      </div>

      {showBulkModal && (
        <BulkDemandStatusModal
          demandIds={selectedIds}
          demandLabels={demandLabels}
          onClose={() => setShowBulkModal(false)}
          onDone={() => { setShowBulkModal(false); setSelectedIds([]); }}
        />
      )}

      {showBulkDeleteModal && (
        <BulkDemandDeleteModal
          items={selectedIds.map((id) => {
            const d = demandsById[id];
            // A selected id from a page we're no longer viewing has no local eligibility
            // data — pass it through optimistically; canDeleteDemand on the server is the
            // real boundary and will report it back as ineligible if it isn't.
            return {
              id,
              label: demandLabels[id] || id,
              eligible: d ? getDemandPermissions(d).canDelete : true,
            };
          })}
          onClose={() => setShowBulkDeleteModal(false)}
          onDone={() => { setShowBulkDeleteModal(false); setSelectedIds([]); }}
        />
      )}

      {showImportModal && (
        <DemandImportModal
          onClose={() => setShowImportModal(false)}
          onDone={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}
