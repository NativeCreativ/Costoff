'use client';

import { useState } from 'react';
import { CompaniesTable } from './CompaniesTable';
import { CompanyImportModal } from './CompanyImportModal';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { DownloadMenu } from '@/components/bulk/DownloadMenu';
import { COMPANY_STATUS_OPTIONS } from '@/constants/options';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { getCompanyExportUrl, getCompanyImportTemplateUrl } from '@/services/companyImport.service';

interface CompaniesViewProps {
  companies: import('@/components/types').Company[];
  loadingCompanies: boolean;
  isFetching?: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  companySearch: string;
  setCompanySearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  canManage: boolean;
  setShowCompanyModal: (v: boolean) => void;
  onEdit: (company: import('@/components/types').Company) => void;
  onView: (company: import('@/components/types').Company) => void;
}

/**
 * Company master list view. Structure deliberately mirrors DemandsView: a single toolbar card
 * (SearchInput on the left, FilterSelects + primary action on the right), the table, then
 * pagination in its own card.
 */
export function CompaniesView({
  companies,
  loadingCompanies,
  isFetching,
  total,
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  companySearch,
  setCompanySearch,
  statusFilter,
  setStatusFilter,
  canManage,
  setShowCompanyModal,
  onEdit,
  onView,
}: CompaniesViewProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const exportFilters = { search: companySearch, status: statusFilter };

  return (
    <>
      <div className="list-toolbar">
        <SearchInput
          value={companySearch}
          onDebouncedChange={setCompanySearch}
          placeholder="Search client, email, phone, location..."
        />
        <div className="list-toolbar-row">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={COMPANY_STATUS_OPTIONS}
            allLabel="All Statuses"
          />

          {/* Bulk actions share the Demands toolbar's look and placement, and are gated by the
              same `canManage` flag (canCreateCompany) the backend enforces on all four
              endpoints — so they can never appear for a role that would get a 403. */}
          {canManage && (
            <>
              <DownloadMenu
                label="Export"
                iconClass="fa-download"
                items={[
                  { label: 'Export Excel (.xlsx)', href: getCompanyExportUrl('xlsx', exportFilters) },
                  { label: 'Export CSV (.csv)', href: getCompanyExportUrl('csv', exportFilters) },
                ]}
              />
              <DownloadMenu
                label="Download Template"
                title="Download a blank template with the expected columns"
                items={[
                  { label: 'Template (.xlsx)', href: getCompanyImportTemplateUrl('xlsx') },
                  { label: 'Template (.csv)', href: getCompanyImportTemplateUrl('csv') },
                ]}
              />
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="toolbar-btn"
              >
                <i className="fa-solid fa-upload"></i>Import Clients
              </button>
              <button
                type="button"
                onClick={() => setShowCompanyModal(true)}
                className="toolbar-btn toolbar-btn-primary"
              >
                + Add New Client
              </button>
            </>
          )}
        </div>
      </div>

      {showImportModal && (
        <CompanyImportModal
          onClose={() => setShowImportModal(false)}
          onDone={() => setShowImportModal(false)}
        />
      )}

      <CompaniesTable
        companies={companies}
        loadingCompanies={loadingCompanies}
        isFetching={isFetching}
        canManage={canManage}
        onView={onView}
        onEdit={onEdit}
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
          itemLabel="companies"
        />
      </div>
    </>
  );
}