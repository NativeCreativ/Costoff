'use client';

import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import '@/components/charts/chartRegistration';
import { barValueLabelPlugin } from './chartPlugins';
import type { AgingBucket } from '../dashboard/dashboardTypes';

/**
 * Demand Aging (ROW 3, right card).
 *
 * Vertical bars for the five days-open buckets (0–7d, 8–14d,
 * 15–30d, 31–60d, 60d+) with the spec colors, a count label
 * above each bar, 4px rounded tops on a #cbd5e1 baseline, and
 * integer y ticks with a computed sensible max.
 */

function niceScale(maxValue: number): { max: number; step: number } {
  if (maxValue <= 0) return { max: 5, step: 1 };
  const rawStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceStep =
    (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
  return { max: Math.ceil(maxValue / niceStep) * niceStep, step: niceStep };
}

export function DemandAgingChart({ buckets }: { buckets: AgingBucket[] }) {
  const maxValue = Math.max(...buckets.map((b) => b.count), 0);
  const { max, step } = niceScale(maxValue);

  const data: ChartData<'bar', number[], string> = {
    labels: buckets.map((b) => b.label),
    datasets: [
      {
        data: buckets.map((b) => b.count),
        backgroundColor: buckets.map((b) => b.color),
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: 'bottom',
        maxBarThickness: 64,
        categoryPercentage: 0.7,
        barPercentage: 0.9,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${Number(context.parsed.y).toLocaleString('en-US')} demands`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: '#cbd5e1' },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        min: 0,
        max,
        ticks: { stepSize: step, precision: 0, color: '#64748b', font: { size: 11 } },
        grid: { color: '#eef2f7' },
        border: { display: false },
      },
    },
  };

  return (
    <div className="h-[260px]">
      <Bar data={data} options={options} plugins={[barValueLabelPlugin]} />
    </div>
  );
}
