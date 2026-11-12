import { prisma } from '@/lib/db/prisma';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';
import type { NotificationFeedItem } from '@/components/types';

/** Raw DB row (Date-typed) as Prisma returns it, before JSON serialization. */
export type NotificationDbRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
};

/**
 * Resolves where each notification navigates to, from its structured entity reference, and
 * returns null `href` when navigation is not appropriate.
 *
 * Demand notifications store `entity_id = demands.id` (a UUID), but the app routes demands by
 * their human Requirement ID (`/demands/CSF-2026-0004`), so the request_id is resolved here
 * server-side and shipped with the feed rather than hard-coding the path in the UI (spec §17).
 *
 * Two spec §24 edge cases are handled by returning `href: null`:
 *   • 21 — the Demand was deleted after the notification was created.
 *   • 22 — the user has since lost visibility of the Demand (e.g. removed from it).
 * Reusing the app's own `canViewDemand` rule means a notification can never become a way around
 * Demand authorization; in that case the item renders as plain text with no link.
 */
export async function attachNavigationForUser(
  items: NotificationDbRow[],
  actor: { role: string; id: string }
): Promise<NotificationFeedItem[]> {
  const demandIds = [
    ...new Set(
      items
        .filter((n) => n.entity_type === 'demand' && n.entity_id)
        .map((n) => n.entity_id as string)
    ),
  ];

  const resolveHref = (row: NotificationDbRow): { href: string | null; requestId: string | null } => {
    if (row.entity_type !== 'demand' || !row.entity_id) return { href: null, requestId: null };
    const demand = demandById.get(row.entity_id);
    if (!demand) return { href: null, requestId: null };
    const recruiterIds = demand.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id);
    if (!canViewDemand(actor, { ...demand, recruiterIds })) return { href: null, requestId: null };
    return { href: demandDetailHref(demand.request_id), requestId: demand.request_id };
  };

  const demandById = new Map<string, { request_id: string; created_by: string | null; contact_profile_id: string | null; spoc_profile_id: string | null; demand_ta_allocations: { ta_id: string | null }[] }>();

  if (demandIds.length > 0) {
    const demands = await prisma.demands.findMany({
      where: { id: { in: demandIds } },
      select: {
        id: true,
        request_id: true,
        created_by: true,
        contact_profile_id: true,
        spoc_profile_id: true,
        demand_ta_allocations: { select: { ta_id: true } },
      },
    });
    for (const d of demands) demandById.set(d.id, d);
  }

  return items.map((row) => {
    const { href, requestId } = resolveHref(row);
    return {
      // Serialize Dates to ISO here so the payload matches the client-side Notification shape
      // exactly (NextResponse.json would do this for the whole body otherwise).
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      is_read: row.is_read,
      read_at: row.read_at ? row.read_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
      href,
      target_request_id: requestId,
    };
  });
}
