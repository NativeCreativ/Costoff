/** User-facing label. The stored lifecycle value stays `Closure` so existing status logic is unchanged. */
export function demandStatusLabel(status?: string | null): string {
  if (!status) return '—';
  if (status === 'Closure') return 'Closed';
  return status;
}
