'use client';

import { AgingBucket } from '@/components/dashboard/dashboardTypes';
import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '@/components/charts/chartRegistration';
import { barValueLabelPlugin } from './chartPlugins';

interface AgingBarChartProps {
  data: AgingBucket[] | null;
  isLoading?: boolean;
  error?: Error | null;
}

/** Spec colors for the five aging buckets (API may also send these). */
const AGING_COLORS = ['#93c5fd', '#93c5fd', '#fbbf24', '#ef4444', '#b91c1c'];

function niceScale(maxValue: number): { max: number; step: number } {
  if (maxValue <= 0) return { max: 1, step: 1 };
  const suggestedMax = Math.ceil(maxValue);
  if (suggestedMax <= 8) return { max: suggestedMax, step: 1 };
  const rawStep = suggestedMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceStep =
    (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
  return { max: Math.ceil(suggestedMax / niceStep) * niceStep, step: niceStep };
}

export function AgingBarChart({ data, isLoading, error }: AgingBarChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center">
        <div className="mb-3 h-16 w-16 animate-spin rounded-full border-4 border-[#e2e8f0] border-t-[#2563eb]" />
        <div className="text-sm text-[#64748b]">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load
      </div>
    );
  }

  if (!data || data.every((b) => b.count === 0)) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center text-sm text-[#64748b]">
        <i className="fa-solid fa-chart-column mb-2 text-xl text-[#cbd5e1]" />
        No aging data
      </div>
    );
  }

  const maxVal = Math.max(...data.map((b) => b.count), 0);
  const { max: suggestedMax, step } = niceScale(maxVal);

  const chartData: ChartData<'bar', number[], string> = {
    labels: data.map((b) => b.label),
    datasets: [
      {
        label: 'Open Demands',
        data: data.map((b) => b.count),
        backgroundColor: data.map((_, i) => AGING_COLORS[i] ?? '#93c5fd'),
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context) => ` Open demands: ${Number(context.raw).toLocaleString('en-US')}`,
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        grid: { display: false },
        ticks: {
          font: { size: 11.5, family: "'Plus Jakarta Sans', sans-serif", weight: 500 },
          color: '#64748b',
        },
        border: { color: '#cbd5e1' },
      },
      y: {
        min: 0,
        suggestedMax,
        grid: { color: '#eef2f7' },
        ticks: {
          font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
          color: '#94a3b8',
          stepSize: step,
          precision: 0,
          callback: (value) => Number(value).toLocaleString('en-US'),
        },
        border: { display: true, color: '#cbd5e1' },
      },
    },
    animation: { duration: 600, easing: 'easeOutQuart' },
  };

  return (
    <div className="relative w-full" style={{ height: 220 }}>
      <Bar data={chartData} options={options} plugins={[barValueLabelPlugin]} />
    </div>
  );
}
