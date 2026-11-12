'use client';

import { useState } from 'react';
import { Check, Copy, Eye, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { TableEmpty } from '@/components/ui/TableEmpty';
import type { Company } from '@/components/types';

interface CompaniesTableProps {
  companies: Company[];
  loadingCompanies: boolean;
  isFetching?: boolean;
  canManage: boolean;
  onView: (company: Company) => void;
  onEdit: (company: Company) => void;
}

// Mirrors DemandsTable's sizing constants so the Company list has the same table footprint,
// header height, row height and skeleton geometry as Demands / Candidates / Interviews.
const TABLE_COLUMNS = 8;
const TABLE_HEADER_HEIGHT = 41;
const TABLE_ROW_HEIGHT = 62;
const TABLE_VISIBLE_ROWS = 10;
const TABLE_AREA_HEIGHT = TABLE_HEADER_HEIGHT + TABLE_VISIBLE_ROWS * TABLE_ROW_HEIGHT;

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'border-transparent bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]',
  INACTIVE: 'border-transparent bg-[#f1f5f9] text-[#64748b] hover:bg-[#f1f5f9]',
};

/**
 * Company master table — View / Edit only. There is deliberately no Delete action: a Company is
 * referenced by `demands.company_id` (ON DELETE RESTRICT) and by company-level round
 * configuration, so it is a persistent master record.
 */
export function CompaniesTable({
  companies,
  loadingCompanies,
  isFetching,
  canManage,
  onView,
  onEdit,
}: CompaniesTableProps) {
  const isLoading = loadingCompanies || !!isFetching;

  // Clipboard copy of the website URL — same pattern InterviewRow uses for the meeting link.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyWebsite = (company: Company) => {
    if (!company.website) return;
    navigator.clipboard
      .writeText(company.website)
      .then(() => {
        setCopiedId(company.id);
        setTimeout(() => setCopiedId(null), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <span>Client Master</span>
          <Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">
            {companies.length}
          </Badge>
        </div>
      </div>

      <div className="table-scroll" style={{ minHeight: TABLE_AREA_HEIGHT }}>
        <table className="w-full text-left text-[0.83rem]">
          <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
            <tr>
              <th className="min-w-[220px] px-4 py-3">Client Name</th>
              <th className="min-w-[180px] px-4 py-3">SPOCs</th>
              <th className="min-w-[200px] px-4 py-3">Email &amp; Phone</th>
              <th className="min-w-[200px] px-4 py-3">Website</th>
              <th className="min-w-[170px] px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Demands</th>
              
              <th className="w-[110px] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {isLoading ? (
              <TableSkeleton columns={TABLE_COLUMNS} rows={TABLE_VISIBLE_ROWS} rowMinHeight={TABLE_ROW_HEIGHT} padded />
            ) : companies.length === 0 ? (
              <TableEmpty colSpan={TABLE_COLUMNS}>
                No clients found matching your filters. Click &quot;+ Add New Client&quot; to add one.
              </TableEmpty>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="transition-colors hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-[#0f172a]">{company.client_name || company.name}</div>
                  </td>
                  <td className="px-4 py-3 align-middle text-[#475569]">
                    {(company.company_spocs ?? []).map((spoc) => spoc.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="text-[#475569]">{company.email || '—'}</div>
                    {company.phone && <div className="text-[0.78rem] text-[#64748b]">{company.phone}</div>}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {company.website ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noreferrer"
                          title={company.website}
                          className="truncate text-[0.8rem] text-[#2563eb] hover:underline"
                        >
                          {company.website.replace(/^https?:\/\//, '')}
                        </a>
                        <button
                          onClick={() => copyWebsite(company)}
                          title="Copy website URL"
                          aria-label={`Copy website URL for ${company.name}`}
                          className="shrink-0 rounded p-1 text-[#94a3b8] transition-colors hover:bg-[#eff6ff] hover:text-[#2563eb]"
                        >
                          {copiedId === company.id ? (
                            <Check className="h-3.5 w-3.5 text-[#16a34a]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="text-[#475569]">
                      {[company.city, company.state].filter(Boolean).join(', ') || '—'}
                    </div>
                    {company.country && <div className="text-[0.78rem] text-[#64748b]">{company.country}</div>}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge className={STATUS_BADGE[company.status] ?? STATUS_BADGE.INACTIVE}>{company.status}</Badge>
                  </td>
                  <td className="px-4 py-3 align-middle text-[#475569]">{company._count?.demands ?? 0}</td>
                  
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onView(company)}
                        title="View company"
                        aria-label={`View ${company.name}`}
                        className="rounded-md border border-[#e2e8f0] bg-white p-1.5 text-[#64748b] transition-colors hover:border-[#bfdbfe] hover:bg-[#eff6ff] hover:text-[#2563eb]"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canManage && (
                        <button
                          onClick={() => onEdit(company)}
                          title="Edit company"
                          aria-label={`Edit ${company.name}`}
                          className="rounded-md border border-[#e2e8f0] bg-white p-1.5 text-[#64748b] transition-colors hover:border-[#bfdbfe] hover:bg-[#eff6ff] hover:text-[#2563eb]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}