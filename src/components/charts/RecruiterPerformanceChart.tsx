'use client';

import { RecruiterRow, RecruiterPerformanceData } from '@/components/dashboard/dashboardTypes';

interface RecruiterPerformanceChartProps {
  data: RecruiterRow[] | RecruiterPerformanceData | null;
  isLoading?: boolean;
  error?: Error | null;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function RecruiterPerformanceChart({ data, isLoading, error }: RecruiterPerformanceChartProps) {
  const rows = Array.isArray(data) ? data : (data?.rows ?? []);
  const totalRecruiters = !Array.isArray(data)
    ? (data?.totalRecruiters ?? data?.totalCount ?? rows.length)
    : rows.length;

  if (isLoading) {
    return (
      <div className="flex h-[200px] flex-col gap-4 py-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-2">
            <div className="h-5 animate-pulse rounded bg-[#f1f5f9]" />
            <div className="space-y-2">
              <div className="h-[10px] animate-pulse rounded bg-[#f1f5f9]" />
              <div className="h-[10px] animate-pulse rounded bg-[#f1f5f9]" />
            </div>
            <div className="h-8 animate-pulse rounded bg-[#f1f5f9]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load recruiters
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-[#64748b]">
        <i className="fa-solid fa-user-group mb-2 text-xl text-[#cbd5e1]" />
        No recruiter data
      </div>
    );
  }

  const maxVal = Math.max(...rows.flatMap((r) => [r.submissions, r.interviews]), 1);

  return (
    <div className="flex flex-col gap-3 py-1">
      {rows.map((recruiter) => {
        const subPct = maxVal > 0 ? Math.min((recruiter.submissions / maxVal) * 100, 100) : 0;
        const intPct = maxVal > 0 ? Math.min((recruiter.interviews / maxVal) * 100, 100) : 0;

        return (
          <div
            key={recruiter.id}
            className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-2"
          >
            <span className="truncate text-left text-[13px] font-medium text-[#334155]">
              {recruiter.name}
            </span>

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="h-[10px] overflow-hidden rounded bg-[#f1f5f9]">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${subPct}%`,
                    backgroundColor: '#2563eb',
                    transition: 'width 0.6s ease-out',
                  }}
                />
              </div>
              <div className="h-[10px] overflow-hidden rounded bg-[#f1f5f9]">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${intPct}%`,
                    backgroundColor: '#0d9488',
                    transition: 'width 0.6s ease-out',
                  }}
                />
              </div>
            </div>

            <div
              className="flex h-full flex-col justify-center gap-1.5 text-right tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <span className="text-[12px] font-bold leading-none text-[#2563eb]">
                {formatNumber(recruiter.submissions)}
              </span>
              <span className="text-[12px] font-bold leading-none text-[#0d9488]">
                {formatNumber(recruiter.interviews)}
              </span>
            </div>
          </div>
        );
      })}

      {totalRecruiters > rows.length ? (
        <p className="mt-1 text-[12px] text-[#64748b]">
          Showing top 5 of {totalRecruiters}
        </p>
      ) : null}
    </div>
  );
}
