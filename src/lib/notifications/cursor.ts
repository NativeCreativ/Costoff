/**
 * Keyset (cursor) pagination for the notification feed.
 *
 * Chosen over offset pagination per spec §12: new notifications arrive while the user is
 * scrolling, and an offset would shift/skip rows. A cursor keyed on the exact sort tuple
 * (created_at DESC, id DESC) is stable under concurrent inserts.
 *
 * The encoder itself is shared with the demand candidate picker — see
 * src/lib/paginationCursor.ts (re-exported here so existing importers are unaffected).
 */

export type { KeysetCursor } from '@/lib/paginationCursor';
export { encodeKeysetCursor as encodeCursor, decodeKeysetCursor as decodeCursor } from '@/lib/paginationCursor';