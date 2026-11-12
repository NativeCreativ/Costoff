import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a date as DD-MM-YYYY, the project's standard display format. */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Formats a time-of-day as HH:MM (24h), the project's standard display format. */
export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Formats a date+time as "DD-MM-YYYY · HH:MM", for timestamps (created_at, etc.). */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/**
 * Formats a DB `@db.Date` column (e.g. interviews.scheduled_date) as DD-MM-YYYY.
 * These columns serialize as a UTC-midnight-anchored ISO string regardless of the
 * viewer's timezone — using formatDate's local-timezone getters on them can roll
 * the displayed date back/forward a day for viewers west/east of UTC. Use this
 * (not formatDate) for any field typed `@db.Date` in schema.prisma.
 */
export function formatScheduledDate(value?: string | Date | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/** Formats a DB `@db.Time` column (e.g. interviews.scheduled_time) as HH:MM (24h). Same UTC-anchoring caveat as formatScheduledDate. */
export function formatScheduledTime(value?: string | Date | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Calculates whole minutes between two "HH:MM" time-of-day strings (same day, e.g. an
 * interview's start/end time). Returns null when either input is missing/malformed or when
 * end is not strictly after start (an invalid range — never produces a negative/zero duration).
 */
export function calculateDurationMinutes(startTime?: string | null, endTime?: string | null): number | null {
  if (!startTime || !endTime) return null;
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const startMatch = timeRe.exec(startTime);
  const endMatch = timeRe.exec(endTime);
  if (!startMatch || !endMatch) return null;
  const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  const endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : null;
}

/** Formats a whole-minutes duration as "1 hour", "30 minutes", "2 hours 30 minutes", etc. */
export function formatDurationMinutes(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ') || '0 minutes';
}

/** "/hour", "/year", etc. derived from a compensation type's name; unknown custom types
 *  fall back to "/<lowercased name>" so an admin-added type still reads sensibly. */
const COMPENSATION_FREQUENCY_SUFFIX: Record<string, string> = {
  Hourly: '/hour',
  Weekly: '/week',
  Monthly: '/month',
  Quarterly: '/quarter',
  'Half Yearly': '/half-year',
  Yearly: '/year',
};

/**
 * Formats a Demand's compensation range for display, e.g. "₹10,00,000 – ₹18,00,000 /year"
 * or "$40 – $60 /hour". Never hardcodes a currency or frequency — both come from the
 * Demand's own linked currency/compensation-type master records. Returns null when there's
 * nothing to show (compensation is optional/negotiable), so callers can render "Negotiable".
 *
 * @deprecated Compensation is stored as free text and must be shown verbatim.
 * Use formatCompensationRange(min, max) instead — this function parses numbers and
 * re-formats them with a currency symbol and locale grouping.
 */
export function formatCompensation(params: {
  currencySymbol?: string | null;
  currencyCode?: string | null;
  compensationTypeName?: string | null;
  min?: number | string | null;
  max?: number | string | null;
}): string | null {
  const { currencySymbol, currencyCode, compensationTypeName, min, max } = params;
  const minNum = min != null && min !== '' ? Number(min) : null;
  const maxNum = max != null && max !== '' ? Number(max) : null;
  if (minNum == null && maxNum == null) return null;

  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  const symbol = currencySymbol || '';
  const fmt = (n: number) => `${symbol}${n.toLocaleString(locale)}`;
  const suffix = compensationTypeName ? COMPENSATION_FREQUENCY_SUFFIX[compensationTypeName] || `/${compensationTypeName.toLowerCase()}` : '';

  const range =
    minNum != null && maxNum != null
      ? `${fmt(minNum)} – ${fmt(maxNum)}`
      : fmt((minNum ?? maxNum) as number);

  return `${range} ${suffix}`.trim();
}

/**
 * The ONE way a Demand's compensation range is rendered anywhere in the app — the
 * detail overview card, the demand list, and every export all call this, so the
 * spacing can never drift between them.
 *
 * The bounds are stored as free text ("6LPA", "1200000", "22 lakh"), so this does
 * no number parsing, no currency symbol and no digit grouping: it only normalizes
 * whitespace and the separator, so the result is always "a - b" with exactly one
 * space on each side of the hyphen. Leading/trailing dashes and spaces are stripped
 * from each bound so nothing can render as "6LPA- 12LPA".
 *
 * Returns "-" when neither bound is set.
 */
export function formatCompensationRange(
  min: string | number | null | undefined,
  max: string | number | null | undefined
): string {
  const clean = (v: string | number | null | undefined) =>
    String(v ?? '').trim().replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '');

  const a = clean(min);
  const b = clean(max);
  if (a && b) return `${a} - ${b}`;
  return a || b || '-';
}

/**
 * Formats a raw currency amount in compact Indian-numbering form: thousands as "K",
 * lakhs (₹1,00,000+) as "L" (e.g. 1100000 -> "11L", 250000 -> "2.5L", 45000 -> "45K",
 * 800 -> "800"). Trims a trailing ".0" so whole values read as "11L" rather than
 * "11.0L". Returns '—' for null/undefined/NaN.
 */
export function formatCompactCurrency(value?: number | string | null, currencySymbol = '₹'): string {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';

  const abs = Math.abs(num);
  let compact: string;
  if (abs >= 100_000) {
    compact = `${(num / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  } else if (abs >= 1_000) {
    compact = `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  } else {
    compact = num.toString();
  }

  return `${currencySymbol}${compact}`;
}
