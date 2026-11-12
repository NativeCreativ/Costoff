'use client';

import Link from 'next/link';
import { CompanyRow, CompanyOverviewData } from '@/components/dashboard/dashboardTypes';
import { navItemById } from '@/lib/navigation/routes';

interface CompanyOverviewTableProps {
  data: CompanyRow[] | CompanyOverviewData | null;
  isLoading?: boolean;
  error?: Error | null;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function getMiniBarStyle(value: number, maxValue: number): React.CSSProperties {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return {
    width: `${pct}%`,
    height: '8px',
    backgroundColor: '#2563eb',
    borderRadius: '4px',
    transition: 'width 0.6s ease-out',
  };
}

const cellPad = { padding: '13px 22px' } as const;
const headPad = { padding: '12px 22px' } as const;

export function CompanyOverviewTable({ data, isLoading, error }: CompanyOverviewTableProps) {
  const rows = Array.isArray(data) ? data : (data?.rows ?? []);
  const totalCompanies = !Array.isArray(data)
    ? (data?.totalCompanies ?? data?.totalCount ?? rows.length)
    : rows.length;
  const companiesHref = navItemById('companies')?.href ?? '/companies';

  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="data-table org-overview-table w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="text-left" style={headPad}>Company</th>
              <th className="w-[130px] text-right" style={headPad}>Open / Total</th>
              <th className="w-[170px] text-right" style={headPad}>Submissions</th>
              <th className="w-[100px] text-right" style={headPad}>Interviews</th>
              <th className="w-[100px] text-right" style={headPad}>Offers</th>
              <th className="w-[100px] text-right" style={headPad}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-[#f1f5f9]">
                <td style={cellPad}><div className="h-4 w-[120px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[60px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[80px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[40px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[40px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[40px] animate-pulse rounded bg-[#f1f5f9]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-[22px] py-10 text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load companies
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-[22px] py-10 text-sm text-[#64748b]">
        <i className="fa-solid fa-building mb-2 text-xl text-[#cbd5e1]" />
        No company data
      </div>
    );
  }

  const maxSubmissions = Math.max(...rows.map((c) => c.submissions), 1);

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="data-table org-overview-table w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]" style={headPad}>
                Company
              </th>
              <th className="w-[130px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]" style={headPad}>
                Open / Total
              </th>
              <th className="w-[170px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]" style={headPad}>
                Submissions
              </th>
              <th className="w-[100px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]" style={headPad}>
                Interviews
              </th>
              <th className="w-[100px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]" style={headPad}>
                Offers
              </th>
              <th className="w-[100px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]" style={headPad}>
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => (
              <tr key={company.id} className="transition-colors hover:bg-[#f8fafc]">
                <td style={cellPad} className="truncate font-semibold text-[#0f172a]">
                  {company.name}
                </td>
                <td
                  style={{ ...cellPad, fontVariantNumeric: 'tabular-nums' }}
                  className="text-right tabular-nums"
                >
                  <span className="font-semibold text-[#0f172a]">{formatNumber(company.open)}</span>
                  <span className="ml-1 text-[#64748b]">/ {formatNumber(company.total)}</span>
                </td>
                <td
                  style={{ ...cellPad, fontVariantNumeric: 'tabular-nums' }}
                  className="text-right tabular-nums"
                >
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-[80px] overflow-hidden rounded bg-[#f1f5f9]">
                      <div style={getMiniBarStyle(company.submissions, maxSubmissions)} />
                    </div>
                    <span className="min-w-[28px] text-right text-[13px] font-bold text-[#0f172a]">
                      {formatNumber(company.submissions)}
                    </span>
                  </div>
                </td>
                <td
                  style={{ ...cellPad, fontVariantNumeric: 'tabular-nums' }}
                  className="text-right text-[#334155] tabular-nums"
                >
                  {formatNumber(company.interviews)}
                </td>
                <td
                  style={{ ...cellPad, fontVariantNumeric: 'tabular-nums' }}
                  className="text-right text-[#334155] tabular-nums"
                >
                  {formatNumber(company.offers)}
                </td>
                <td
                  style={{ ...cellPad, fontVariantNumeric: 'tabular-nums' }}
                  className="text-right text-[13px] font-bold text-[#15803d] tabular-nums"
                >
                  {formatNumber(company.joined)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalCompanies > rows.length ? (
        <div className="flex items-center justify-between border-t border-[#f1f5f9] px-[22px] py-[10px] text-[12px] text-[#64748b]">
          <span>Showing top 5 of {totalCompanies}</span>
          <Link href={companiesHref} className="font-semibold text-[#2563eb] hover:underline">
            Client Master
          </Link>
        </div>
      ) : null}
    </div>
  );
}
