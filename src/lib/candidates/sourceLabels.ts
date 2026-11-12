// Rule: one shared label formatter for source values everywhere.
// Maps internal source keys to display labels used in Calendar, Pipeline filter/cards, Exports.
export const SOURCE_LABELS: Record<string, string> = {
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  direct: 'Direct Portal',
  referral: 'Referral',
  others: 'Others',
};

/** Returns the display label for a source key. Returns the key itself if unknown (no silent fallback). */
export function formatSourceLabel(source: string | null | undefined): string {
  if (!source) return '';
  const key = source.trim().toLowerCase();
  return SOURCE_LABELS[key] ?? key;
}