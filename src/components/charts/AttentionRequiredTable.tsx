'use client';

import Link from 'next/link';
import { AttentionData, AttentionState } from '@/components/dashboard/dashboardTypes';
import { navItemById } from '@/lib/navigation/routes';

interface AttentionRequiredTableProps {
  data: AttentionData | null;
  isLoading?: boolean;
  error?: Error | null;
  /** Total open demands (for empty-state gating and top-N footer). */
  totalOpenDemands?: number;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function getDaysOpenBadgeStyle(state: AttentionState): React.CSSProperties {
  if (state === 'red_flag') return { backgroundColor: '#fee2e2', color: '#b91c1c' };
  if (state === 'approaching') return { backgroundColor: '#fef3c7', color: '#92400e' };
  return { backgroundColor: '#f1f5f9', color: '#475569' };
}

function getPriorityStyle(priority: string | null): React.CSSProperties {
  if (priority?.toLowerCase() === 'high') return { color: '#b91c1c', fontWeight: 700 };
  return { color: '#64748b', fontWeight: 700 };
}

const cellPad = { padding: '13px 22px' } as const;
const headPad = { padding: '12px 22px' } as const;

export function AttentionRequiredTable({
  data,
  isLoading,
  error,
  totalOpenDemands,
}: AttentionRequiredTableProps) {
  const demandsHref = navItemById('demands')?.href ?? '/demands';
  const openTotal = totalOpenDemands ?? data?.totalDemands ?? data?.totalCount ?? 0;
  const rows = data?.rows ?? [];

  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="data-table org-overview-table w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="text-left" style={headPad}>Requirement</th>
              <th className="text-left" style={headPad}>Company</th>
              <th className="text-left" style={headPad}>Role</th>
              <th className="text-left" style={headPad}>Priority</th>
              <th className="w-[100px] text-right" style={headPad}>Days open</th>
              <th className="text-left" style={headPad}>AM</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-[#f1f5f9]">
                <td style={cellPad}><div className="h-4 w-[180px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="h-4 w-[100px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="h-4 w-[120px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="h-4 w-[60px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="ml-auto h-4 w-[70px] animate-pulse rounded bg-[#f1f5f9]" /></td>
                <td style={cellPad}><div className="h-4 w-[100px] animate-pulse rounded bg-[#f1f5f9]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-[22px] py-8 text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load attention items
      </div>
    );
  }

  // Empty only when there are no open demands at all.
  if (openTotal === 0 || (!data && openTotal === 0)) {
    return (
      <div className="flex flex-col items-center justify-center px-[22px] py-8 text-sm text-[#64748b]">
        <i className="fa-solid fa-flag mb-2 text-xl text-[#cbd5e1]" />
        No open demands
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-[22px] py-8 text-sm text-[#64748b]">
        <i className="fa-solid fa-flag mb-2 text-xl text-[#cbd5e1]" />
        No open demands
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
                Requirement
              </th>
              <th
                className="text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Company
              </th>
              <th
                className="text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Role
              </th>
              <th
                className="text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Priority
              </th>
              <th
                className="w-[100px] text-right text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                Days open
              </th>
              <th
                className="text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748b]"
                style={headPad}
              >
                AM
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const daysOpen = row.daysOpen ?? row.days_open ?? 0;
              const company = row.company ?? row.company_name ?? null;
              const role = row.role ?? row.job_title ?? null;
              const amName = row.amName ?? row.am_name ?? null;
              const state: AttentionState =
                row.state ??
                (row.isRedFlag ? 'red_flag' : daysOpen >= 15 ? 'approaching' : 'on_track');

              return (
                <tr key={row.id} className="transition-colors hover:bg-[#f8fafc]">
                  <td
                    style={cellPad}
                    className="max-w-[250px] truncate font-semibold text-[#0f172a]"
                    title={row.requirement}
                  >
                    {row.requirement}
                  </td>
                  <td style={cellPad} className="truncate text-[#334155]">
                    {company || '—'}
                  </td>
                  <td style={cellPad} className="truncate text-[#334155]">
                    {role || '—'}
                  </td>
                  <td style={{ ...cellPad, ...getPriorityStyle(row.priority) }}>
                    {row.priority || '—'}
                  </td>
                  <td style={cellPad} className="text-right">
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-[12px] font-extrabold tabular-nums"
                      style={{
                        ...getDaysOpenBadgeStyle(state),
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatNumber(daysOpen)}d
                    </span>
                  </td>
                  <td style={cellPad} className="truncate text-[#334155]">
                    {amName || 'Unassigned'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* {openTotal > rows.length ? (
        <div className="flex items-center justify-between border-t border-[#f1f5f9] px-[22px] py-[10px] text-[12px] text-[#64748b]">
          <span>Showing top 5 of {openTotal}</span>
          <Link href={demandsHref} className="font-semibold text-[#2563eb] hover:underline">
            Demands / Requirements
          </Link>
        </div>
      ) : null} */}
    </div>
  );
}
