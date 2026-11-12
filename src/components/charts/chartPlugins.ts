import type { Plugin } from 'chart.js';

/**
 * Shared Chart.js plugins for the Org Overview dashboard.
 * All drawing uses the dashboard palette only.
 */

/** Bold count/value label drawn above the top of each bar. */
export const barValueLabelPlugin: Plugin<'bar'> = {
  id: 'barValueLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value == null || !bar) return;
        const x = bar.x;
        const y = bar.y;
        ctx.save();
        ctx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(Number(value).toLocaleString('en-US'), x, y - 4);
        ctx.restore();
      });
    });
  },
};

/**
 * Center label for the Demand Status donut: the total as a bold 24px
 * number with a small "open" caption below it. Enabled via
 * `options.plugins.centerText = { total }`.
 */
export const centerTextPlugin: Plugin<'doughnut'> = {
  id: 'centerText',
  afterDraw(chart, _args, options) {
    const opts = options as { total?: number } | undefined;
    if (!opts || opts.total == null) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "800 24px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = '#0f172a';
    ctx.fillText(Number(opts.total).toLocaleString('en-US'), x, y - 6);
    ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = '#64748b';
    ctx.fillText('open', x, y + 14);
    ctx.restore();
  },
};

/**
 * Bold value label above the last data point of each line series, plus
 * a visible dot on that point (the dot itself is configured per
 * dataset via pointRadius).
 */
export const lastValueLabelPlugin: Plugin<'line'> = {
  id: 'lastValueLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      const lastIndex = meta.data.length - 1;
      const lastPoint = meta.data[lastIndex];
      const value = dataset.data[lastIndex];
      if (!lastPoint || value == null) return;
      ctx.save();
      ctx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = dataset.borderColor as string;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(Number(value).toLocaleString('en-US'), lastPoint.x, lastPoint.y - 6);
      ctx.restore();
    });
  },
};
