'use client';

import Link from 'next/link';
import { SourceEffectivenessRow, SourceEffectivenessData } from '@/components/dashboard/dashboardTypes';
import { navItemById } from '@/lib/navigation/routes';

interface SourceEffectivenessChartProps {
  data: SourceEffectivenessRow[] | SourceEffectivenessData | null;
  isLoading?: boolean;
  error?: Error | null;
  fullReportHref?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function getBarStyle(value: number, maxValue: number, isBest: boolean): React.CSSProperties {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return {
    width: `${pct}%`,
    height: '14px',
    backgroundColor: isBest ? '#0d9488' : '#2563eb',
    borderRadius: '4px',
    transition: 'width 0.6s ease-out',
  };
}

export function SourceEffectivenessChart({
  data,
  isLoading,
  error,
  fullReportHref,
}: SourceEffectivenessChartProps) {
  const rows = Array.isArray(data) ? data : (data?.rows ?? []);
  const totalSources = !Array.isArray(data)
    ? (data?.totalSources ?? data?.totalCount ?? rows.length)
    : rows.length;
  const href = fullReportHref ?? navItemById('client_analytics')?.href ?? '/performance/client-analytics';

  if (isLoading) {
    return (
      <div className="flex h-[160px] flex-col gap-2.5 py-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="h-5 w-[84px] shrink-0 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-[14px] flex-1 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-5 w-[50px] shrink-0 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-5 w-[40px] shrink-0 animate-pulse rounded bg-[#f1f5f9]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load sources
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#64748b]">
        <i className="fa-solid fa-magnifying-glass-chart mb-2 text-xl text-[#cbd5e1]" />
        No source data
      </div>
    );
  }

  const maxCount = Math.max(...rows.map((s) => s.count), 1);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2.5 py-2.5">
        {rows.map((source) => (
          <div key={source.source} className="flex items-center gap-2.5">
            <span className="w-[84px] shrink-0 pr-2 text-right text-[12.5px] text-[#475569]">
              {source.label}
            </span>
            <div className="h-[14px] flex-1 overflow-hidden rounded bg-[#f1f5f9]">
              <div style={getBarStyle(source.count, maxCount, source.isBest)} />
            </div>
            <span
              className="w-[50px] shrink-0 text-right text-[12.5px] font-bold text-[#0f172a] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatNumber(source.count)}
            </span>
            <span
              className="w-[44px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums"
              style={{
                color: source.isBest ? '#0d9488' : '#64748b',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {source.submittedPct}%
            </span>
          </div>
        ))}
      </div>
      {totalSources > rows.length ? (
        <div className="mt-1 flex items-center justify-between border-t border-[#f1f5f9] pt-2.5 text-[12px] text-[#64748b]">
          <span>Showing top 5 of {totalSources}</span>
          <Link href={href} className="font-semibold text-[#2563eb] hover:underline">
            Client &amp; Source Analytics
          </Link>
        </div>
      ) : null}
    </div>
  );
}
