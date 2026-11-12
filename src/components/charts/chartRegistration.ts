import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

/**
 * chart.js ships unregistered — every chart (including the
 * react-chartjs-2 wrappers) needs its scales, elements and controllers
 * registered once before first render. Importing this module from each
 * chart component registers them exactly once (ES module singleton).
 *
 * chart.js + react-chartjs-2 are the project's installed chart
 * libraries (package.json) and are the only ones used.
 */
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

// Match the app's typography (Plus Jakarta Sans) and muted text color.
Chart.defaults.font.family =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.color = '#64748b';
