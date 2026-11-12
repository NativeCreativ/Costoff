'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { EntitySelect } from '@/components/ui/EntitySelect';
import { Button } from '@/components/ui/button';
import { getCompanies, getCompany, getCompaniesDropdown } from '@/services/company.service';
import { canQuickCreateCompany, canUseCompanyDropdown } from '@/lib/auth/companyPermissions';
import { COMPANY_ACTIVE_STATUS, COMPANY_INACTIVE_OPTION_TAG, isCompanyActiveForNewDemand } from '@/components/companies/company.schema';
import type { Company } from '@/components/types';

interface CompanySelectProps {
  /** Current company id (a Company master id) — supplied by the caller's Controller. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  currentUserRole?: string;
  /** Display name of an already-selected company, so the trigger isn't blank while options load. */
  initialCompanyLabel?: string;
  /**
   * Create-mode only (Add New / Clone Demand): enables the "+ Add Client" button.
   *
   * Doubles as the "is this a create form?" signal for the empty-state copy, so the component
   * needs no separate mode prop — the caller passes it straight from its own isCreateMode.
   */
  allowQuickCreate?: boolean;
  /** Called when the user clicks "+ Add Client" — the caller (DemandFormModal) opens the full drawer. */
  onQuickCreate?: () => void;
  clientLockedByDrawer?: boolean;
}

/**
 * Searchable single-select Company master, plus the Demand-form-only "+ Add Client" button.
 *
 * ONLY ACTIVE companies are ever offered. That applies in BOTH create and edit mode:
 *   • Create — a new Demand may only be raised against an ACTIVE company.
 *   • Edit   — a Demand must not be moved ONTO an inactive company.
 *
 * The one exception is the Demand's CURRENT company: if it has gone INACTIVE since the Demand
 * was raised, it is still resolved into the list so the field keeps showing what the Demand
 * actually points at, tagged "Inactive" and non-selectable. Dropping it instead would leave the
 * form either blank or silently rewriting the Demand's company. It can be neither re-picked nor
 * replaced with another inactive company, and the value is never cleared.
 */
export function CompanySelect({
  value,
  onChange,
  error,
  disabled,
  currentUserRole,
  initialCompanyLabel,
  allowQuickCreate,
  onQuickCreate,
  clientLockedByDrawer,
}: CompanySelectProps) {
  const [search, setSearch] = useState('');

  // The list is ACTIVE-only in every mode, so an inactive company can never be chosen.
  // `status` is part of the query key so this list is a distinct cache entry from the Company
  // Master's own unfiltered list. GET /api/companies already supports ?status= (it powers the
  // Company Master status filter) — no new endpoint or client-side filtering is involved.
  const isSuperAdmin = currentUserRole === 'super_admin';

  // Super admin sees all active companies; AM sees only their own via the role-scoped dropdown.
  // Transform the dropdown response to match PaginatedResult<Company> shape.
  const companiesQuery = useQuery({
    queryKey: ['companies', search, COMPANY_ACTIVE_STATUS, isSuperAdmin],
    queryFn: async () => {
      if (isSuperAdmin) return getCompanies({ search, status: COMPANY_ACTIVE_STATUS, pageSize: 20 });
      const companies = await getCompaniesDropdown(search);
      return { data: companies, total: companies.length, page: 1, pageSize: companies.length, totalPages: 1 };
    },
    staleTime: 30 * 1000,
  });

  // Resolve the Demand's current company separately so an INACTIVE one is still rendered.
  // Only runs once a company is selected (i.e. in edit mode / on a pre-filled clone) and uses
  // the existing GET /api/companies/[id] endpoint; the id is the key, so it is cached and shared
  // with the Company Master detail view.
  const currentCompanyQuery = useQuery({
    queryKey: ['company', value],
    queryFn: () => getCompany(value),
    enabled: !!value,
    staleTime: 30 * 1000,
  });

  const options = (companiesQuery.data?.data ?? []).map((c: any) => ({
    id: c.id,
    label: c.name,
    sublabel: [c.client_name && c.client_name !== c.name ? c.client_name : '', c.city, c.country]
      .filter(Boolean)
      .join(' • '),
  }));

  // The current company that is NOT in the ACTIVE list must still be visible — otherwise an
  // existing Demand on an inactive company would show an empty/blank trigger, and saving could
  // wipe or silently swap the Demand's company.
  const current = currentCompanyQuery.data as Company | undefined;
  const currentIsInactive = !!current && !isCompanyActiveForNewDemand(current.status);
  const currentOption =
    current && currentIsInactive && !options.some((o) => o.id === current.id)
      ? {
          id: current.id,
          label: current.name,
          sublabel: [current.client_name && current.client_name !== current.name ? current.client_name : '', current.city, current.country]
            .filter(Boolean)
            .join(' • '),
          tag: COMPANY_INACTIVE_OPTION_TAG,
          disabled: true,
        }
      : null;

  // Fallback for the brief window before GET /api/companies/[id] resolves, so the trigger is
  // never blank (same "resolved options" pattern the form uses for AM/SPOC/Recruiter).
  const placeholderOption =
    !currentOption && initialCompanyLabel && value && !options.some((o) => o.id === value)
      ? { id: value, label: initialCompanyLabel }
      : null;

  const resolvedOptions = currentOption
    ? [currentOption, ...options]
    : placeholderOption
    ? [placeholderOption, ...options]
    : options;

  const canQuickCreate = allowQuickCreate && canQuickCreateCompany(currentUserRole) && isSuperAdmin;

  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-2">
        <div className="flex-1">
          {/* No Controller here on purpose: this component already receives `value`/`onChange`
              from the caller's own <Controller name="company_id">. Wrapping it in a second
              Controller with no `control` prop (and a render fn that ignores `field`) made the
              field uncontrolled, which is what broke typing/selection in the Demand form. */}
          <EntitySelect
            mode="single"
            label="Client"
            required
            placeholder="Search or select a company…"
            searchPlaceholder="Search by company, client, city…"
            emptyLabel={
              allowQuickCreate
                ? 'No active company matches. Inactive companies cannot be used for a new Demand.'
                : 'No matching company.'
            }
            options={resolvedOptions}
            value={value}
            onChange={onChange}
            onSearchChange={setSearch}
            isLoading={companiesQuery.isFetching}
            error={error}
            disabled={disabled || !!clientLockedByDrawer}
          />
        </div>
        {canQuickCreate && !disabled && !clientLockedByDrawer && (
          <Button type="button" size="sm" variant="outline" onClick={onQuickCreate} className="mb-0.5 h-9 shrink-0 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Client
          </Button>
        )}
      </div>
      {clientLockedByDrawer && <p className="mt-1 text-[0.72rem] text-[#64748b]">Client created for this demand</p>}
    </div>
  );
}