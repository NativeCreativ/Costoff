'use client';

import { useMemo, useState } from 'react';
import { Candidate } from '../types';
import { CandidatesTable } from './CandidatesTable';
import { BulkCandidateDeleteModal } from './BulkCandidateDeleteModal';
import { CandidateImportModal } from './CandidateImportModal';
import { getCandidateExportUrl, getCandidateImportTemplateUrl, type CandidateExportFilters } from '@/services/candidateImport.service';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { CANDIDATE_SOURCE_OPTIONS, WORK_MODE_OPTIONS } from '@/constants/options';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';

interface CandidatesViewProps {
  candidates: Candidate[];
  loadingCandidates: boolean;
  isFetching?: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  candidateSearch: string;
  setCandidateSearch: (v: string) => void;
  candidateSourceFilter: string;
  setCandidateSourceFilter: (v: string) => void;
  candidateWorkModeFilter: string;
  setCandidateWorkModeFilter: (v: string) => void;
  candidateStageFilter: string;
  setCandidateStageFilter: (v: string) => void;
  setCandidateDedupeError: (v: string | null) => void;
  setShowCandidateModal: (v: boolean) => void;
  editCandidateStage: string;
  openCandidateHistory: (candidateId: string) => void;
  renderStageTag: (stage: string) => React.ReactNode;
  onEdit: (c: Candidate) => void;
  onDeleteRequest: (c: Candidate) => void;
  /**
   * Whether the current role may create a candidate in the global master pool from this
   * page. Only super_admin: recruiters and AMs must create inside a demand they are
   * assigned to / own, and they add candidates from that demand's Pipeline. Mirrors
   * MASTER_POOL_CREATE_ROLES in lib/auth/candidatePermissions. UX only — POST
   * /api/candidates is the actual boundary and returns 403 without a valid demand.
   */
  canCreateCandidates?: boolean;
  /** AM / Recruiter / Super Admin only — enables row checkboxes + "Bulk Delete" on this page. */
  canBulkDeleteCandidates?: boolean;
  /** AM / Recruiter / Super Admin only (CANDIDATE_WRITE_ROLES) — enables "Import Candidates" + "Download Template". Export is visible to everyone who can view the list. */
  canImportCandidates?: boolean;
  /** Currently-applied filters, passed through to the Export Excel/CSV links so the export reflects what's on screen. */
  candidateExportFilters?: CandidateExportFilters;
}

export function CandidatesView({
  candidates, loadingCandidates, isFetching, total, page, totalPages, onPageChange, pageSize, onPageSizeChange,
  candidateSearch, setCandidateSearch, candidateSourceFilter, setCandidateSourceFilter,
  candidateWorkModeFilter, setCandidateWorkModeFilter,
  candidateStageFilter, setCandidateStageFilter, setCandidateDedupeError, setShowCandidateModal,
  editCandidateStage, openCandidateHistory, renderStageTag, onEdit, onDeleteRequest,
  canCreateCandidates = true,
  canBulkDeleteCandidates,
  canImportCandidates,
  candidateExportFilters,
}: CandidatesViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const candidatesById = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);

  const toggleSelect = (item: Candidate) => {
    setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
  };
  const toggleSelectAll = (allIds: string[]) => {
    setSelectedIds((prev) => (allIds.every((id) => prev.includes(id)) ? prev.filter((id) => !allIds.includes(id)) : [...new Set([...prev, ...allIds])]));
  };

  return (
    <>
      <div className="list-toolbar">
        <SearchInput
          value={candidateSearch}
          onDebouncedChange={setCandidateSearch}
          placeholder="Search name, email, phone, company, designation, location, skills..."
        />
        <div className="list-toolbar-row">
          <FilterSelect value={candidateWorkModeFilter} onChange={setCandidateWorkModeFilter} options={WORK_MODE_OPTIONS} allLabel="All Work Modes" />
          <FilterSelect value={candidateSourceFilter} onChange={setCandidateSourceFilter} options={CANDIDATE_SOURCE_OPTIONS} allLabel="All Sources" />
          <FilterSelect
            value={candidateStageFilter}
            onChange={setCandidateStageFilter}
            allLabel="All Pipeline Stages"
            options={[
              { value: 'Sourced', label: 'Sourced' },
              { value: 'Submitted', label: 'Submitted' },
              { value: 'Shortlisted', label: 'Shortlisted' },
              { value: 'Interviewing', label: 'Interviewing' },
              { value: 'Selected', label: 'Selected' },
              { value: 'Offered', label: 'Offered' },
              { value: 'Joined', label: 'Joined' },
              { value: 'Rejected', label: 'Rejected' },
            ]}
          />
          <Popover open={exportMenuOpen} onOpenChange={setExportMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="toolbar-btn">
                <i className="fa-solid fa-download"></i>Export
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1">
              <a
                href={getCandidateExportUrl('xlsx', candidateExportFilters)}
                download
                onClick={() => setExportMenuOpen(false)}
                className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
              >
                Export Excel (.xlsx)
              </a>
              <a
                href={getCandidateExportUrl('csv', candidateExportFilters)}
                download
                onClick={() => setExportMenuOpen(false)}
                className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
              >
                Export CSV (.csv)
              </a>
            </PopoverContent>
          </Popover>
          {canImportCandidates && (
            <>
              <Popover open={templateMenuOpen} onOpenChange={setTemplateMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="cursor-pointer rounded-md border border-[#e2e8f0] bg-white px-3.5 py-2 text-[0.83rem] font-semibold text-[#475569] hover:bg-[#f8fafc]"
                    title="Download a blank template with the expected columns"
                  >
                    Download Template
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-44 p-1">
                  <a
                    href={getCandidateImportTemplateUrl('xlsx')}
                    download
                    onClick={() => setTemplateMenuOpen(false)}
                    className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
                  >
                    Template (.xlsx)
                  </a>
                  <a
                    href={getCandidateImportTemplateUrl('csv')}
                    download
                    onClick={() => setTemplateMenuOpen(false)}
                    className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
                  >
                    Template (.csv)
                  </a>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="toolbar-btn"
              >
                <i className="fa-solid fa-upload"></i>Import Candidates
              </button>
            </>
          )}
          {canCreateCandidates && (
            <button type="button" onClick={() => { setCandidateDedupeError(null); setShowCandidateModal(true); }} className="toolbar-btn toolbar-btn-primary">
              + Add New Candidate
            </button>
          )}
        </div>
      </div>

      <CandidatesTable
        candidates={candidates}
        loadingCandidates={loadingCandidates}
        isFetching={isFetching}
        editCandidateStage={editCandidateStage}
        openCandidateHistory={openCandidateHistory}
        renderStageTag={renderStageTag}
        onEdit={onEdit}
        onDeleteRequest={onDeleteRequest}
        bulkSelectable={canBulkDeleteCandidates}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
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
          itemLabel="candidates"
        />
      </div>

      {showBulkDeleteModal && (
        <BulkCandidateDeleteModal
          items={selectedIds.map((id) => {
            const c = candidatesById[id];
            // A selected id from a page we're no longer viewing has no local eligibility
            // data — pass it through optimistically; the server's own ownership/workflow
            // check is the real boundary and will report it back as ineligible if it isn't.
            return { id, label: c?.full_name || id, eligible: c ? c.can_edit !== false : true };
          })}
          onClose={() => setShowBulkDeleteModal(false)}
          onDone={() => { setShowBulkDeleteModal(false); setSelectedIds([]); }}
        />
      )}

      {showImportModal && (
        <CandidateImportModal
          onClose={() => setShowImportModal(false)}
          onDone={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}
