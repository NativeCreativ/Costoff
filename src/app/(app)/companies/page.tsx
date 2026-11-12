'use client';

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setFilter, setPage, setPageSize, setSearch, LISTS } from '@/features/listState/listStateSlice';
import { canCreateCompany } from '@/lib/auth/companyPermissions';
import { useCompaniesQuery } from '@/queries/companies/useCompaniesQuery';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { CompaniesView } from '@/components/companies/CompaniesView';
import { CompanyFormModal, CompanyViewModal } from '@/components/companies/CompanyFormModal';
import type { Company } from '@/components/types';
import { RequireRole } from '@/components/layout/RequireRole';

/**
 * /companies — the Company master module.
 *
 * Create / View / Edit / Search only: there is deliberately no Delete action anywhere in this
 * module, because a Company is referenced by demands (`demands.company_id`, ON DELETE RESTRICT)
 * and by company-level interview-round configuration.
 *
 * Clients Master is super_admin only.
 */
export default function CompaniesPage() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.listState[LISTS.companies]);
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;

  const [showCreate, setShowCreate] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);

  const filter = (key: string) => list.filters[key] ?? '';
  const setFilterValue = (key: string) => (v: string) =>
    dispatch(setFilter({ list: LISTS.companies, key, value: v }));

  const companiesQuery = useCompaniesQuery({
    search: list.search,
    status: filter('status'),
    page: list.page,
    pageSize: list.pageSize,
  });

  const canManage = canCreateCompany(currentUser?.role);

  return (
    <RequireRole role="super_admin">
      <CompaniesView
        companies={companiesQuery.data?.data ?? []}
        loadingCompanies={companiesQuery.isLoading}
        isFetching={companiesQuery.isFetching}
        total={companiesQuery.data?.total ?? 0}
        page={list.page}
        totalPages={companiesQuery.data?.totalPages ?? 1}
        onPageChange={(page: number) => dispatch(setPage({ list: LISTS.companies, page }))}
        pageSize={list.pageSize}
        onPageSizeChange={(pageSize: number) => dispatch(setPageSize({ list: LISTS.companies, pageSize }))}
        companySearch={list.search}
        setCompanySearch={(v: string) => dispatch(setSearch({ list: LISTS.companies, value: v }))}
        statusFilter={filter('status')}
        setStatusFilter={setFilterValue('status')}
        canManage={canManage}
        setShowCompanyModal={(v) => v && setShowCreate(true)}
        onEdit={(company) => setEditingCompany(company)}
        onView={(company) => setViewingCompany(company)}
      />

      {showCreate && <CompanyFormModal mode="create" onClose={() => setShowCreate(false)} />}

      {editingCompany && (
        <CompanyFormModal mode="edit" editingCompany={editingCompany} onClose={() => setEditingCompany(null)} />
      )}

      {viewingCompany && <CompanyViewModal company={viewingCompany} onClose={() => setViewingCompany(null)} />}
    </RequireRole>
  );
}