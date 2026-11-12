'use client';

import { DemandStatusData } from '@/components/dashboard/dashboardTypes';
import type { ChartData, ChartOptions } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import '@/components/charts/chartRegistration';

interface DemandStatusDonutProps {
  data: DemandStatusData | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function DemandStatusDonut({ data, isLoading, error }: DemandStatusDonutProps) {
  if (isLoading) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center">
        <div className="mb-3 h-16 w-16 animate-spin rounded-full border-4 border-[#e2e8f0] border-t-[#2563eb]" />
        <div className="text-sm text-[#64748b]">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center text-sm text-[#64748b]">
        <i className="fa-solid fa-chart-pie mb-2 text-xl text-[#cbd5e1]" />
        No open demands
      </div>
    );
  }

  const chartData: ChartData<'doughnut', number[], string> = {
    labels: data.segments.map((s) => s.label),
    datasets: [
      {
        data: data.segments.map((s) => s.count),
        backgroundColor: data.segments.map((s) => s.color),
        borderWidth: 0,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw);
            const pct = data.total > 0 ? Math.round((value / data.total) * 100) : 0;
            return ` ${context.label}: ${value.toLocaleString('en-US')} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="relative flex h-[200px] w-full items-center">
      <div className="relative h-full w-[55%] min-w-[140px]">
        <Doughnut data={chartData} options={options} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[24px] font-extrabold leading-none text-[#0f172a] tabular-nums"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {data.total.toLocaleString('en-US')}
          </span>
          <span className="mt-0.5 text-[11px] text-[#64748b]">open</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center pr-1" style={{ gap: 10 }}>
        {data.segments.map((segment) => (
          <div key={segment.key} className="flex items-center" style={{ gap: 8 }}>
            <div
              className="h-[9px] w-[9px] shrink-0 rounded"
              style={{ backgroundColor: segment.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#475569]">
              {segment.label}
            </span>
            <span
              className="shrink-0 text-right text-[12.5px] font-bold text-[#0f172a] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {segment.count.toLocaleString('en-US')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
