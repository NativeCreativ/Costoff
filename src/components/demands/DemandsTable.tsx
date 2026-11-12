"use client";

import { Demand } from "../types";
import { DemandTableRow } from "./DemandTableRow";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { TableEmpty } from "@/components/ui/TableEmpty";

interface DemandsTableProps {
  demands: Demand[];
  loadingDemands: boolean;
  isFetching?: boolean;
  getDemandPermissions: (item: Demand) => { canEdit: boolean; canDelete: boolean; canClone: boolean; deleteDisabledReason?: string };
  openLifecycle: (reqId: string) => void;
  onEdit: (item: Demand) => void;
  onDeleteRequest: (item: Demand) => void;
  onCloneRequest: (item: Demand) => void;
  /** Bulk-select (AM/Super Admin only) — shows a checkbox column and "Bulk Status Change" bar when any row is selected. */
  bulkSelectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (item: Demand) => void;
  onToggleSelectAll?: (allIds: string[]) => void;
  onBulkStatusChange?: () => void;
  onBulkDelete?: () => void;
}

const TABLE_COLUMNS = 11;
const TABLE_HEADER_HEIGHT = 41;
const TABLE_ROW_HEIGHT = 62;
const TABLE_VISIBLE_ROWS = 10;
const TABLE_AREA_HEIGHT = TABLE_HEADER_HEIGHT + TABLE_VISIBLE_ROWS * TABLE_ROW_HEIGHT;

export function DemandsTable({
  demands,
  loadingDemands,
  isFetching,
  getDemandPermissions,
  openLifecycle,
  onEdit,
  onDeleteRequest,
  onCloneRequest,
  bulkSelectable,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onBulkStatusChange,
  onBulkDelete,
}: DemandsTableProps) {
  const isLoading = loadingDemands || !!isFetching;
  const allIds = demands.map((d) => d.id);
  const allSelected = bulkSelectable && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <span>Demand Requirements</span>
          <Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">
            {demands.length}
          </Badge>
        </div>
        {bulkSelectable && selectedIds.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[0.8rem] font-semibold text-[#2563eb]">{selectedIds.length} selected</span>
            <button
              onClick={onBulkStatusChange}
              className="rounded-md bg-[#2563eb] px-3.5 py-1.5 text-[0.8rem] font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Bulk Status Change
            </button>
            <button
              onClick={onBulkDelete}
              className="rounded-md bg-[#dc2626] px-3.5 py-1.5 text-[0.8rem] font-semibold text-white hover:bg-[#dc2626]/90"
            >
              Bulk Delete
            </button>
          </div>
        )}
      </div>
      <div className="table-scroll" style={{ minHeight: TABLE_AREA_HEIGHT }}>
        <table className="w-full text-left text-[0.83rem]">
          <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
            <tr>
              {bulkSelectable && (
                <th className="w-[40px] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll?.(allIds)}
                    className="h-4 w-4 cursor-pointer rounded border-[#cbd5e1]"
                  />
                </th>
              )}
              <th className="w-[150px] whitespace-nowrap px-4 py-3">Requirement ID</th>
              <th className="min-w-[180px] px-4 py-3">Client</th>
              <th className="min-w-[220px] px-4 py-3">
                Requirement Title
              </th>
              <th className="min-w-[180px] px-4 py-3">Required Skills</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Days Open</th>
              <th className="px-4 py-3">
                Account Manager
                <br />
                &amp; SPOC
              </th>
              <th className="px-4 py-3">Recruiter</th>
              <th className="w-[130px] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {isLoading ? (
              <TableSkeleton columns={bulkSelectable ? TABLE_COLUMNS + 1 : TABLE_COLUMNS} rows={TABLE_VISIBLE_ROWS} rowMinHeight={TABLE_ROW_HEIGHT} padded />
            ) : demands.length === 0 ? (
              <TableEmpty colSpan={bulkSelectable ? TABLE_COLUMNS + 1 : TABLE_COLUMNS}>
                No demands found matching your filters. Click &quot;+ Add New Demand&quot; to add one.
              </TableEmpty>
            ) : (
              demands.map((demand) => (
                <DemandTableRow
                  key={demand.id}
                  item={demand}
                  {...getDemandPermissions(demand)}
                  openLifecycle={openLifecycle}
                  onEdit={onEdit}
                  onDeleteRequest={onDeleteRequest}
                  onCloneRequest={onCloneRequest}
                  selectable={bulkSelectable}
                  selected={selectedIds.includes(demand.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
