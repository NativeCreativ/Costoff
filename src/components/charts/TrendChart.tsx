'use client';

import { TrendData } from '@/components/dashboard/dashboardTypes';
import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import '@/components/charts/chartRegistration';
import { lastValueLabelPlugin } from './chartPlugins';

interface TrendChartProps {
  data: TrendData | null;
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

export function TrendChart({ data, isLoading, error }: TrendChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center">
        <div className="mb-3 h-16 w-16 animate-spin rounded-full border-4 border-[#e2e8f0] border-t-[#2563eb]" />
        <div className="text-sm text-[#64748b]">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center text-sm text-[#ef4444]">
        <i className="fa-solid fa-triangle-exclamation mb-2 text-xl" />
        Failed to load trend
      </div>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center text-sm text-[#64748b]">
        <i className="fa-solid fa-chart-line mb-2 text-xl text-[#cbd5e1]" />
        No trend data
      </div>
    );
  }

  const labels = data.months.map((m) => (typeof m === 'string' ? m : m.label));
  const lastIndex = labels.length - 1;
  const maxVal = Math.max(...data.submissions, ...data.selections, 0);
  const { max: suggestedMax, step } = niceScale(maxVal);

  const chartData: ChartData<'line', number[], string> = {
    labels,
    datasets: [
      {
        label: 'Submissions',
        data: data.submissions,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.07)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.25,
        pointRadius: data.submissions.map((_, i) => (i === lastIndex ? 4 : 0)),
        pointHoverRadius: 5,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        clip: false,
      },
      {
        label: 'Selections',
        data: data.selections,
        borderColor: '#0d9488',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        fill: false,
        tension: 0.25,
        pointRadius: data.selections.map((_, i) => (i === lastIndex ? 4 : 0)),
        pointHoverRadius: 5,
        pointBackgroundColor: '#0d9488',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        clip: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          title: (items) => (items[0]?.label ? String(items[0].label) : ''),
          label: (context) =>
            ` ${context.dataset.label}: ${Number(context.parsed.y).toLocaleString('en-US')}`,
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
        grace: 0,
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
    <div className="relative w-full" style={{ height: 240 }}>
      <Line data={chartData} options={options} plugins={[lastValueLabelPlugin]} />
    </div>
  );
}
