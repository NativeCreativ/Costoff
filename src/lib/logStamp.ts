/**
 * Log stamps (review batch 5, Nov 2026): every line added to a running text log starts with when
 * and who — "[18 Nov 2026, 10:42 · Priya Sharma] Candidate confirmed the slot". Times are India
 * time so the stamp reads the same for everyone.
 */
export function logStamp(authorName: string | null | undefined, at: Date = new Date()): string {
  const when = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
  return `[${when} · ${authorName?.trim() || 'Unknown'}]`;
}

/** Appends one stamped line to a text log. Blank text adds nothing. */
export function appendStampedLine(log: string | null | undefined, text: string, authorName: string | null | undefined, at: Date = new Date()): string {
  const line = text.trim();
  if (!line) return log ?? '';
  return [log?.trim(), `${logStamp(authorName, at)} ${line}`].filter(Boolean).join('\n');
}
