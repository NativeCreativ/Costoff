// Rule: an opaque keyset cursor is "<ISO created_at>|<uuid>" over the sort tuple
// (created_at DESC, id DESC). Opaque so callers cannot depend on its shape.
// First written for the notification feed (src/lib/notifications/cursor.ts re-exports it).

export interface KeysetCursor {
  createdAt: string;
  id: string;
}

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, 'utf8').toString('base64');
}

/** Returns null for an absent/malformed cursor, so a bad value means "first page". */
export function decodeKeysetCursor(raw: string | null | undefined): KeysetCursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const separator = decoded.indexOf('|');
    if (separator <= 0) return null;
    const createdAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!createdAt || !id) return null;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return { createdAt: date.toISOString(), id };
  } catch {
    return null;
  }
}