'use client';

import { InterviewActivityDay } from '@/components/dashboard/dashboardTypes';
import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '@/components/charts/chartRegistration';
import { barValueLabelPlugin } from './chartPlugins';

interface InterviewActivityChartProps {
  data: InterviewActivityDay[] | null;
  isLoading?: boolean;
  error?: Error | null;
}

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

export function InterviewActivityChart({ data, isLoading, error }: InterviewActivityChartProps) {
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

  if (!data || data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center text-sm text-[#64748b]">
        <i className="fa-solid fa-calendar-days mb-2 text-xl text-[#cbd5e1]" />
        No interviews this week
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 0);
  const { max: suggestedMax, step } = niceScale(maxVal);
  // Bar value labels already show counts — hide y tick labels to avoid clutter.
  const hideYLabels = true;

  const chartData: ChartData<'bar', number[], string> = {
    labels: data.map((d) => (d.isToday ? 'Today' : d.label)),
    datasets: [
      {
        label: 'Interviews',
        data: data.map((d) => d.count),
        backgroundColor: data.map((d) => (d.isToday ? '#2563eb' : '#bfdbfe')),
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        barPercentage: 0.5,
        categoryPercentage: 0.7,
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
          label: (context) => ` Interviews: ${Number(context.raw).toLocaleString('en-US')}`,
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        grid: { display: false },
        ticks: {
          font: (ctx) => {
            const index = ctx.index ?? 0;
            const isToday = Boolean(data[index]?.isToday);
            return {
              size: 12,
              family: "'Plus Jakarta Sans', sans-serif",
              weight: isToday ? 'bold' : 'normal',
            };
          },
          color: (ctx) => {
            const index = ctx.index ?? 0;
            return data[index]?.isToday ? '#1d4ed8' : '#64748b';
          },
        },
        border: { color: '#cbd5e1' },
      },
      y: {
        min: 0,
        suggestedMax,
        grid: { color: '#eef2f7' },
        ticks: {
          display: !hideYLabels,
          font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
          color: '#94a3b8',
          stepSize: step,
          precision: 0,
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
