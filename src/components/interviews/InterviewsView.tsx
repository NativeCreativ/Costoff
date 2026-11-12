"use client";

import { useMemo, useState } from "react";
import { Interview } from "../types";
import { InterviewsTable } from "./InterviewsTable";
import { BulkInterviewStatusModal } from "./BulkInterviewStatusModal";
import { BulkInterviewDeleteModal } from "./BulkInterviewDeleteModal";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Pagination } from "@/components/ui/Pagination";
import { useInterviewStatusOptions } from "@/components/interviews/useInterviewStatusOptions";
import { INTERVIEW_RESULT_VALUES } from "@/lib/demandFulfillment/constants";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { EntitySelect } from "@/components/ui/EntitySelect";
import { FilterOption } from "@/services/interview.service";
import type { InterviewRowActions } from "@/lib/auth/interviewPermissions";

const RESULT_OPTIONS = INTERVIEW_RESULT_VALUES.map((v) => ({
  value: v,
  label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

interface InterviewsViewProps {
  interviews: Interview[];
  loadingInterviews: boolean;
  interviewSearch: string;
  setInterviewSearch: (v: string) => void;
  roundFilter: string;
  setRoundFilter: (v: string) => void;
  interviewRoundOptions: FilterOption[];
  roundOptionsLoading?: boolean;
  roundOnSearchChange?: (term: string) => void;
  modeFilter: string;
  setModeFilter: (v: string) => void;
  interviewModeOptions: FilterOption[];
  modeOptionsLoading?: boolean;
  modeOnSearchChange?: (term: string) => void;
  interviewStatusFilter: string;
  setInterviewStatusFilter: (v: string) => void;
  resultFilter: string;
  setResultFilter: (v: string) => void;
  companyFilter: string;
  setCompanyFilter: (v: string) => void;
  companyOptions: FilterOption[];
  companyLoading?: boolean;
  companyOnSearchChange?: (term: string) => void;
  companySelectedLabel?: string;
  amFilter: string;
  setAmFilter: (v: string) => void;
  amOptions: FilterOption[];
  amLoading?: boolean;
  amOnSearchChange?: (term: string) => void;
  amSelectedLabel?: string;
  currentUserRole?: string | null;
  interviewDateFrom: string;
  setInterviewDateFrom: (v: string) => void;
  interviewDateTo: string;
  setInterviewDateTo: (v: string) => void;
  setShowInterviewModal: (v: boolean) => void;
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
  canScheduleInterview: boolean;
  /** Can this role bulk-change status / bulk-delete interviews at all (role gate only —
   *  the real per-item ownership/status check always happens server-side). */
  canBulkManageInterviews?: boolean;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  total: number;
  totalPages: number;
}

export function InterviewsView({
  interviews,
  loadingInterviews,
  interviewSearch,
  setInterviewSearch,
  roundFilter,
  setRoundFilter,
  interviewRoundOptions,
  roundOptionsLoading,
  roundOnSearchChange,
  modeFilter,
  setModeFilter,
  interviewModeOptions,
  modeOptionsLoading,
  modeOnSearchChange,
  interviewStatusFilter,
  setInterviewStatusFilter,
  resultFilter,
  setResultFilter,
  companyFilter,
  setCompanyFilter,
  companyOptions,
  companyLoading,
  companyOnSearchChange,
  companySelectedLabel,
  amFilter,
  setAmFilter,
  amOptions,
  amLoading,
  amOnSearchChange,
  amSelectedLabel,
  currentUserRole,
  interviewDateFrom,
  setInterviewDateFrom,
  interviewDateTo,
  setInterviewDateTo,
  setShowInterviewModal,
  openLifecycle,
  onDeleteRequest,
  getInterviewStatusStyle,
  setSelectedInterview,
  onEdit,
  getInterviewActions,
  canScheduleInterview,
  canBulkManageInterviews,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  total,
  totalPages,
}: InterviewsViewProps) {
  const { all: interviewStatusOptions } = useInterviewStatusOptions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const interviewsById = useMemo(() => Object.fromEntries(interviews.map((iv) => [iv.id, iv])), [interviews]);
  const interviewLabels = useMemo(
    () => Object.fromEntries(interviews.map((iv) => [iv.id, `${iv.candidate_name || iv.id}${iv.demand_request_id ? ` (${iv.demand_request_id})` : ""}`])),
    [interviews]
  );

  /**
   * Resolve the selected rows for a bulk flow, using the SAME helper the row actions use, so
   * a row can never be actionable in the table but skipped here (or the reverse). A selected
   * id from a page we're no longer viewing has no local data — it is passed through as
   * eligible and the server's per-row check is the real boundary, reported back as a skip.
   */
  const bulkItems = (action: 'canEdit' | 'canDelete') =>
    selectedIds.map((id) => {
      const iv = interviewsById[id];
      const resolved = iv ? getInterviewActions(iv) : null;
      const eligible = resolved ? resolved[action] : true;
      return {
        id,
        label: interviewLabels[id] || id,
        eligible,
        reason: eligible ? null : (action === 'canEdit' ? resolved!.editBlockedReason : resolved!.deleteBlockedReason) || 'Not permitted',
      };
    });

  const toggleSelect = (item: Interview) => {
    setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
  };
  const toggleSelectAll = (allIds: string[]) => {
    setSelectedIds((prev) => (allIds.every((id) => prev.includes(id)) ? prev.filter((id) => !allIds.includes(id)) : [...new Set([...prev, ...allIds])]));
  };

  const hasActiveFilters =
    !!interviewSearch || !!roundFilter || !!modeFilter || !!interviewStatusFilter ||
    !!resultFilter || !!companyFilter || !!amFilter || !!interviewDateFrom || !!interviewDateTo;

  const clearFilters = () => {
    setInterviewSearch("");
    setRoundFilter("");
    setModeFilter("");
    setInterviewStatusFilter("");
    setResultFilter("");
    setCompanyFilter("");
    setAmFilter("");
    setInterviewDateFrom("");
    setInterviewDateTo("");
  };

  return (
    <>
      <div className="list-toolbar">
        <SearchInput
          value={interviewSearch}
          onDebouncedChange={setInterviewSearch}
          placeholder="Search requirement ID, job title, candidate name/email, created by name/email..."
          className="w-full"
        />
        <div className="list-toolbar-row items-end">
          <div className="flex min-w-0 flex-wrap items-end gap-2.5">
            <div className="w-[180px]">
              <EntitySelect
                mode="single"
                label="Interview Round"
                placeholder="All Rounds"
                searchPlaceholder="Type to search round…"
                options={[{ id: '', label: 'All Rounds' }, ...interviewRoundOptions.map((r) => ({ id: r.value, label: r.label }))]}
                value={roundFilter}
                onChange={setRoundFilter}
                onSearchChange={roundOnSearchChange}
                debounceMs={300}
                isLoading={roundOptionsLoading}
                emptyLabel="No rounds found"
                selectedLabel={roundFilter}
              />
            </div>
            <div className="w-[180px]">
              <EntitySelect
                mode="single"
                label="Interview Mode"
                placeholder="All Modes"
                searchPlaceholder="Type to search mode…"
                options={[{ id: '', label: 'All Modes' }, ...interviewModeOptions.map((m) => ({ id: m.value, label: m.label }))]}
                value={modeFilter}
                onChange={setModeFilter}
                onSearchChange={modeOnSearchChange}
                debounceMs={300}
                isLoading={modeOptionsLoading}
                emptyLabel="No modes found"
                selectedLabel={modeFilter}
              />
            </div>
            <FilterSelect
              label="Interview Status"
              value={interviewStatusFilter}
              onChange={setInterviewStatusFilter}
              options={interviewStatusOptions}
              allLabel="All Statuses"
            />
            <FilterSelect
              label="Interview Result"
              value={resultFilter}
              onChange={setResultFilter}
              options={RESULT_OPTIONS}
              allLabel="All Results"
            />
            <div className="w-[190px]">
              <EntitySelect
                mode="single"
                label="Company"
                placeholder="All Companies"
                searchPlaceholder="Type to search company…"
                options={[{ id: '', label: 'All Companies' }, ...companyOptions.map((c) => ({ id: c.value, label: c.label }))]}
                value={companyFilter}
                onChange={setCompanyFilter}
                onSearchChange={companyOnSearchChange}
                debounceMs={300}
                isLoading={companyLoading}
                selectedLabel={companySelectedLabel}
                emptyLabel="No companies found"
              />
            </div>
            {currentUserRole !== 'account_manager' && (
              <div className="w-[190px]">
                <EntitySelect
                  mode="single"
                  label="Account Manager"
                  placeholder="All Account Managers"
                  searchPlaceholder="Type to search AM…"
                  options={[{ id: '', label: 'All Account Managers' }, ...amOptions.map((a) => ({ id: a.value, label: a.label }))]}
                  value={amFilter}
                  onChange={setAmFilter}
                  onSearchChange={amOnSearchChange}
                  debounceMs={300}
                  isLoading={amLoading}
                  selectedLabel={amSelectedLabel}
                  emptyLabel="No account managers found"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">From Date</label>
              <input
                type="date"
                value={interviewDateFrom}
                onChange={(e) => setInterviewDateFrom(e.target.value)}
                className="button-select"
              />
            </div>
            <div>
              <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">To Date</label>
              <input
                type="date"
                value={interviewDateTo}
                onChange={(e) => setInterviewDateTo(e.target.value)}
                className="button-select"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="h-auto rounded-md border-[#e2e8f0] px-3.5 py-2 text-[0.83rem] font-semibold"
              >
                Clear Filters
              </Button>
            )}
          </div>
          {canScheduleInterview && (
            <Button
              onClick={() => setShowInterviewModal(true)}
              className="h-auto rounded-md px-3.5 py-2 text-[0.83rem] font-semibold"
            >
              + Schedule Interview
            </Button>
          )}
        </div>
      </div>

      <InterviewsTable
        interviews={interviews}
        loadingInterviews={loadingInterviews}
        openLifecycle={openLifecycle}
        onDeleteRequest={onDeleteRequest}
        getInterviewStatusStyle={getInterviewStatusStyle}
        setSelectedInterview={setSelectedInterview}
        onEdit={onEdit}
        getInterviewActions={getInterviewActions}
        pageSize={pageSize}
        bulkSelectable={canBulkManageInterviews}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onBulkStatusChange={() => setShowBulkStatusModal(true)}
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
          itemLabel="interviews"
        />
      </div>

      {showBulkStatusModal && (
        <BulkInterviewStatusModal
          items={bulkItems('canEdit')}
          onClose={() => setShowBulkStatusModal(false)}
          onDone={(keptIds) => { setShowBulkStatusModal(false); setSelectedIds(keptIds); }}
        />
      )}

      {showBulkDeleteModal && (
        <BulkInterviewDeleteModal
          items={bulkItems('canDelete')}
          onClose={() => setShowBulkDeleteModal(false)}
          onDone={(keptIds) => { setShowBulkDeleteModal(false); setSelectedIds(keptIds); }}
        />
      )}
    </>
  );
}
