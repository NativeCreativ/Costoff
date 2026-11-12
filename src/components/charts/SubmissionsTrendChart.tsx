'use client';

import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import '@/components/charts/chartRegistration';
import { lastValueLabelPlugin } from './chartPlugins';
import type { TrendData } from '../dashboard/dashboardTypes';


const SUBMISSIONS_COLOR = '#2563eb';
const SELECTIONS_COLOR = '#0d9488';

function niceScale(maxValue: number): { max: number; step: number } {
  if (maxValue <= 0) return { max: 5, step: 1 };
  const rawStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceStep =
    (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
  return { max: Math.ceil(maxValue / niceStep) * niceStep, step: niceStep };
}

export function SubmissionsTrendChart({ trend }: { trend: TrendData }) {
  const maxValue = Math.max(...trend.submissions, ...trend.selections, 0);
  const { max, step } = niceScale(maxValue);

  const data: ChartData<'line', number[], string> = {
    labels: trend.months.map((m) => (typeof m === 'string' ? m : m.label)),
    datasets: [
      {
        label: 'Submissions',
        data: trend.submissions,
        borderColor: SUBMISSIONS_COLOR,
        backgroundColor: 'rgba(37, 99, 235, 0.07)',
        fill: true,
        borderWidth: 2.5,
        tension: 0,
        pointRadius: trend.submissions.map((_, index) =>
          index === trend.submissions.length - 1 ? 4 : 0,
        ),
        pointHoverRadius: 5,
        pointBackgroundColor: SUBMISSIONS_COLOR,
        pointBorderColor: SUBMISSIONS_COLOR,
      },
      {
        label: 'Selections',
        data: trend.selections,
        borderColor: SELECTIONS_COLOR,
        backgroundColor: SELECTIONS_COLOR,
        fill: false,
        borderWidth: 2.5,
        tension: 0,
        pointRadius: trend.selections.map((_, index) =>
          index === trend.selections.length - 1 ? 4 : 0,
        ),
        pointHoverRadius: 5,
        pointBackgroundColor: SELECTIONS_COLOR,
        pointBorderColor: SELECTIONS_COLOR,
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
        callbacks: {
          label: (context) =>
            ` ${context.dataset.label}: ${Number(context.parsed.y).toLocaleString('en-US')}`,
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
      <Line data={data} options={options} plugins={[lastValueLabelPlugin]} />
    </div>
  );
}
