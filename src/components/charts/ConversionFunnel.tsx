'use client';

import type { FunnelData } from '../dashboard/dashboardTypes';

/**
 * Recruitment Conversion Funnel (ROW 2, left card).
 *
 * Seven horizontal bar rows, one per pipeline stage. Joined stays
 * visible with count 0 and no bar. Conversion % blank for the first
 * stage and when the previous stage is 0.
 */

interface ConversionFunnelProps {
  funnel: FunnelData | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function ConversionFunnel({ funnel, isLoading, error }: ConversionFunnelProps) {
  if (isLoading) {
    return (
      <div className="flex h-[160px] flex-col gap-2 py-2.5">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-[128px] shrink-0 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-[26px] flex-1 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-5 w-[34px] shrink-0 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-5 w-[44px] shrink-0 animate-pulse rounded bg-[#f1f5f9]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load funnel
      </div>
    );
  }

  if (!funnel || funnel.stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#64748b]">
        <i className="fa-solid fa-chart-simple mb-2 text-xl text-[#cbd5e1]" />
        No funnel data
      </div>
    );
  }

  // Show the funnel whenever we have stages — including Joined at 0 with no bar.
  // Only blank when every stage is missing data entirely (no stages above).
  const firstStageCount = funnel.stages[0]?.count ?? 0;
  const allZero = funnel.stages.every((s) => s.count === 0);
  if (allZero) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#64748b]">
        <i className="fa-solid fa-chart-simple mb-2 text-xl text-[#cbd5e1]" />
        No funnel data
      </div>
    );
  }

  return (
    <div>
      {funnel.stages.map((stage, index) => {
        const previousCount = index > 0 ? funnel.stages[index - 1].count : null;
        const widthPct =
          firstStageCount > 0 && stage.count > 0
            ? Math.max((stage.count / firstStageCount) * 100, 2.5)
            : 0;
        const conversionPct =
          previousCount != null && previousCount > 0
            ? Math.round((stage.count / previousCount) * 100)
            : null;

        return (
          <div key={stage.key} className="mb-[11px] flex items-center gap-3 last:mb-0">
            <span className="w-[128px] shrink-0 text-right text-[12.5px] text-[#475569]">
              {stage.label}
            </span>
            <div className="h-[26px] min-w-0 flex-1">
              {widthPct > 0 ? (
                <div
                  className="h-full rounded-[5px]"
                  style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
                />
              ) : null}
            </div>
            <span
              className="w-[34px] shrink-0 text-right text-[13px] font-bold text-[#0f172a] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {stage.count.toLocaleString('en-US')}
            </span>
            <span
              className="w-[44px] shrink-0 text-right text-xs text-[#64748b] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {conversionPct != null ? `${conversionPct}%` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
