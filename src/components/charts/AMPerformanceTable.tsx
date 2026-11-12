'use client';

import Link from 'next/link';
import { AmRow, AmPerformanceData } from '@/components/dashboard/dashboardTypes';
import { navItemById } from '@/lib/navigation/routes';

interface AMPerformanceTableProps {
  data: AmRow[] | AmPerformanceData | null;
  isLoading?: boolean;
  error?: Error | null;
}

const ACCEPTANCE_HIGH_PCT = 50;

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function getAcceptanceStyle(pct: number | null): React.CSSProperties {
  if (pct === null) return { color: '#64748b' };
  if (pct >= ACCEPTANCE_HIGH_PCT) return { color: '#0f766e', fontWeight: 600 };
  return { color: '#92400e', fontWeight: 600 };
}

const cellPad = { padding: '13px 22px' } as const;
const headPad = { padding: '12px 22px' } as const;

export function AMPerformanceTable({ data, isLoading, error }: AMPerformanceTableProps) {
  const rows = Array.isArray(data) ? data : (data?.rows ?? []);
  const totalAms = !Array.isArray(data)
    ? (data?.totalAccountManagers ?? data?.totalAms ?? data?.totalCount ?? rows.length)
    : rows.length;
  const amHref = navItemById('performance_am')?.href ?? '/performance/account-managers';

  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="data-table org-overview-table w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="text-left" style={headPad}>Account Manager</th>
              <th className="w-[90px] text-right" style={headPad}>Open</th>
              <th className="w-[100px] text-right" style={headPad}>Accept.</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-[#f1f5f9]">
                <td style={cellPad}><div className="h-4 w-[140px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[40px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[50px] animate-pulse rounded bg-[#f1f5f9]" /></td>
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
        Failed to load AMs
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-[22px] py-10 text-sm text-[#64748b]">
        <i className="fa-solid fa-briefcase mb-2 text-xl text-[#cbd5e1]" />
        No AM data
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="data-table org-overview-table w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th
                className="text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Account Manager
              </th>
              <th
                className="w-[90px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Open
              </th>
              <th
                className="w-[100px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Accept.
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((am) => (
              <tr key={am.id} className="transition-colors hover:bg-[#f8fafc]">
                <td style={cellPad} className="truncate font-medium text-[#0f172a]">
                  {am.name}
                </td>
                <td
                  style={{ ...cellPad, fontVariantNumeric: 'tabular-nums' }}
                  className="text-right text-[13px] font-bold text-[#0f172a] tabular-nums"
                >
                  {formatNumber(am.openDemands)}
                </td>
                <td
                  style={{
                    ...cellPad,
                    fontVariantNumeric: 'tabular-nums',
                    ...getAcceptanceStyle(am.acceptPct),
                  }}
                  className="text-right text-[13px] tabular-nums"
                >
                  {am.acceptPct !== null ? `${am.acceptPct}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalAms > rows.length ? (
        <div className="flex items-center justify-between border-t border-[#f1f5f9] px-[22px] py-[10px] text-[12px] text-[#64748b]">
          <span>Showing top 5 of {totalAms}</span>
          <Link href={amHref} className="font-semibold text-[#2563eb] hover:underline">
            AM Performance
          </Link>
        </div>
      ) : null}
    </div>
  );
}
