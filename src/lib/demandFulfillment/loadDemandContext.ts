import { prisma } from '@/lib/db/prisma';

export interface DemandContext {
  id: string;
  request_id: string;
  status: string | null;
  num_positions: number | null;
  created_by: string | null;
  contact_profile_id: string | null;
  spoc_profile_id: string | null;
  recruiterIds: string[];
  technology_stack: string[];
  /** Saved, not yet submitted (review batch 4). canViewDemand hides it from everyone else. */
  is_draft: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads the fields every fulfillment-module route needs to run a permission check.
 * Accepts either the demand's UUID or its human-readable request_id (the [requestId]
 * dynamic segment is shared with the existing /demands/[requestId]/lifecycle route,
 * which supports both — this mirrors that lookup so both id shapes keep working).
 */
export async function loadDemandContext(idOrRequestId: string): Promise<DemandContext | null> {
  const demand = await prisma.demands.findFirst({
    where: UUID_RE.test(idOrRequestId) ? { id: idOrRequestId } : { request_id: idOrRequestId },
    select: {
      id: true,
      request_id: true,
      status: true,
      num_positions: true,
      created_by: true,
      contact_profile_id: true,
      spoc_profile_id: true,
      technology_stack: true,
      is_draft: true,
      demand_ta_allocations: { select: { ta_id: true } },
    },
  });
  if (!demand) return null;

  return {
    id: demand.id,
    request_id: demand.request_id,
    status: demand.status,
    num_positions: demand.num_positions,
    created_by: demand.created_by,
    contact_profile_id: demand.contact_profile_id,
    spoc_profile_id: demand.spoc_profile_id,
    recruiterIds: demand.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id),
    technology_stack: demand.technology_stack ?? [],
    is_draft: demand.is_draft,
  };
}
