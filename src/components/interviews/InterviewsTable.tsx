"use client";

import { Interview } from "../types";
import { InterviewRow } from "./InterviewRow";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { TableEmpty } from "@/components/ui/TableEmpty";
import type { InterviewRowActions } from "@/lib/auth/interviewPermissions";

const TABLE_COLUMNS = 13;
const TABLE_HEADER_HEIGHT = 41;
const TABLE_ROW_HEIGHT = 62;
/** Rows visible on screen without scrolling at the default page size — the skeleton fills
 *  this many rows regardless of the selected page size, so it matches what's actually on
 *  screen instead of growing to cover an entire large page (e.g. 100 rows) off-screen. */
const TABLE_VISIBLE_ROWS = 10;

interface InterviewsTableProps {
  interviews: Interview[];
  loadingInterviews: boolean;
  openLifecycle: (reqId: string) => void;
  onDeleteRequest: (item: Interview) => void;
  getInterviewStatusStyle: (status: string) => {
    bg: string;
    text: string;
    border: string;
    dot: string;
    label: string;
  };
  setSelectedInterview: (iv: Interview) => void;
  onEdit: (iv: Interview) => void;
  /** Resolved by the shared getInterviewRowActions() helper (role gate + status rule). */
  getInterviewActions: (iv: Interview) => InterviewRowActions;
  /** Current page size — the skeleton never renders more rows than this, so a small last
   *  page doesn't show a taller skeleton than the data it's about to replace. */
  pageSize: number;
  /** Bulk-select — shows a checkbox column and "N selected" bar when any row is selected. */
  bulkSelectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (item: Interview) => void;
  onToggleSelectAll?: (allIds: string[]) => void;
  onBulkStatusChange?: () => void;
  onBulkDelete?: () => void;
}

export function InterviewsTable({
  interviews,
  loadingInterviews,
  openLifecycle,
  onDeleteRequest,
  getInterviewStatusStyle,
  setSelectedInterview,
  onEdit,
  getInterviewActions,
  pageSize,
  bulkSelectable,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onBulkStatusChange,
  onBulkDelete,
}: InterviewsTableProps) {
  const skeletonRows = Math.max(1, Math.min(TABLE_VISIBLE_ROWS, pageSize));
  const tableAreaHeight = TABLE_HEADER_HEIGHT + TABLE_VISIBLE_ROWS * TABLE_ROW_HEIGHT;
  const allIds = interviews.map((iv) => iv.id);
  const allSelected = bulkSelectable && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const columnCount = bulkSelectable ? TABLE_COLUMNS + 1 : TABLE_COLUMNS;
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <span>Interviews Tracking Log</span>
          <Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">
            {interviews.length}
          </Badge>
        </div>
        {bulkSelectable && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3">
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
      <div className="table-scroll" style={{ minHeight: tableAreaHeight }}>
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
              <th className="min-w-[180px] px-4 py-3">Requirement</th>
              <th className="min-w-[180px] px-4 py-3">Client</th>
              <th className="min-w-[160px] px-4 py-3">Account Manager</th>
              <th className="min-w-[160px] px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Interview Round</th>
              <th className="min-w-[180px] px-4 py-3">Created</th>
              <th className="min-w-[170px] px-4 py-3">Interview Date &amp; Time</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Link Status</th>
              <th className="min-w-[180px] px-4 py-3">Meeting Link</th>
              <th className="w-[130px] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {loadingInterviews ? (
              <TableSkeleton columns={columnCount} rows={skeletonRows} rowMinHeight={TABLE_ROW_HEIGHT} padded />
            ) : interviews.length === 0 ? (
              <TableEmpty colSpan={columnCount}>
                No interview slots found matching your filters. Click &quot;+ Schedule Interview&quot; to book a slot.
              </TableEmpty>
            ) : (
              interviews.map((interview) => (
                <InterviewRow
                  key={interview.id}
                  item={interview}
                  openLifecycle={openLifecycle}
                  onDeleteRequest={onDeleteRequest}
                  getInterviewStatusStyle={getInterviewStatusStyle}
                  setSelectedInterview={setSelectedInterview}
                  onEdit={onEdit}
                  actions={getInterviewActions(interview)}
                  selectable={bulkSelectable}
                  selected={selectedIds.includes(interview.id)}
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
