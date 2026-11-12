import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { buildNotificationContent, type DemandAssignedPayload } from './constants';

/**
 * Minimal shape of the Prisma transaction client, so these helpers compose with the existing
 * `$transaction(async (tx) => …)` blocks in the Demand routes (and with `prisma` itself).
 */
type Tx = {
  notifications: {
    createMany: (args: {
      data: Prisma.notificationsCreateManyInput[];
      skipDuplicates?: boolean;
    }) => Promise<unknown>;
  };
};

export interface AssignmentState {
  /** Currently active SPOC profile id on the demand, if any. */
  spocId: string | null;
  /** Currently allocated recruiter (TA) profile ids on the demand. */
  recruiterIds: string[];
}

/**
 * Creates Demand-assignment notifications for users who are NEWLY assigned.
 *
 * This is the single place the assignment-notification rules live (spec §4/§7), shared by all
 * three Demand write paths — Create (POST /api/demands), Edit (PUT /api/demands) and Reassign
 * (POST /api/demands/[requestId]/assign) — so the three can never drift apart:
 *
 *   • Only newly-assigned users are notified. Someone already on the demand gets nothing, so
 *     re-saving an unchanged demand produces zero notifications (spec §7).
 *   • Reassignment notifies only the incoming user, never the outgoing one (spec §7, §5 tests).
 *   • Removals are never notified (spec §7).
 *   • Never notifies Super Admin / AM merely for creating or assigning (spec §1).
 *   • Each newly-assigned recruiter gets their OWN row (spec §8, multiple recruiters).
 *
 * Runs inside the caller's transaction, so a failed Demand write can never leave orphan
 * notifications behind (spec §6). The unique dedupe_key index is the final backstop: a repeat is
 * rejected by Postgres rather than merely avoided in application code (spec §5).
 *
 * Returns the notifications created, for tests and for the response payload.
 */
export async function notifyNewlyAssigned(
  tx: Tx,
  args: {
    demandId: string;
    requestId: string;
    jobTitle?: string | null;
    /** Assignment state BEFORE this write. */
    previous: AssignmentState;
    /** Assignment state AFTER this write. */
    next: AssignmentState;
    /** The authenticated actor — excluded unless the demand genuinely changed hands to them. */
    actorId: string;
    actorName?: string | null;
  }
): Promise<number> {
  const { demandId, requestId, jobTitle, previous, next, actorId, actorName } = args;

  const previousRecruiters = new Set(previous.recruiterIds);
  const nextRecruiters = next.recruiterIds.filter(Boolean);

  // Collect (recipient, role) pairs explicitly rather than deriving them from array positions —
  // keeps the "who gets notified" decision obvious and free of index arithmetic.
  const assignments: { userId: string; roleInDemand: DemandAssignedPayload['roleInDemand'] }[] = [];

  if (next.spocId && next.spocId !== previous.spocId) {
    assignments.push({ userId: next.spocId, roleInDemand: 'spoc' });
  }
  for (const recruiterId of nextRecruiters) {
    if (!previousRecruiters.has(recruiterId)) {
      assignments.push({ userId: recruiterId, roleInDemand: 'recruiter' });
    }
  }

  // Fingerprint of the state BEFORE this change. Two concurrent identical submissions share it
  // (so their dedupe keys collide and only one notification is stored), while a genuine
  // re-assignment after a removal has a different one (so it is allowed to notify again).
  const previousStateFingerprint = fingerprintAssignmentState(previous);

  const rows = assignments
    // The actor is not told about their own assignment action (spec §1).
    .filter((a) => a.userId !== actorId)
    .map((a) => ({
      ...buildNotificationContent(
        {
          requestId,
          jobTitle,
          roleInDemand: a.roleInDemand,
          userId: a.userId,
          previousStateFingerprint,
          actorName,
        },
        demandId
      ),
      user_id: a.userId,
    }));

  if (rows.length === 0) return 0;

  // skipDuplicates makes the unique dedupe_key index a no-op instead of an error, so a retried
  // assignment request succeeds while still not producing a second notification.
  await tx.notifications.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

/**
 * Short, stable fingerprint of an assignment state, used in the notification dedupe key.
 *
 * djb2 over a canonical string (SPOC id + sorted recruiter ids) — no crypto import needed for
 * what is only a change-detector, and short enough to keep the dedupe_key column small.
 */
function fingerprintAssignmentState(state: AssignmentState): string {
  const canonical = `${state.spocId ?? '-'}|${[...state.recruiterIds].sort().join(',')}`;
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** Reads a demand's current SPOC + recruiter assignment, for the "previous state" comparison. */export async function loadAssignmentState(demandId: string): Promise<AssignmentState> {
  const demand = await prisma.demands.findUnique({
    where: { id: demandId },
    select: {
      spoc_profile_id: true,
      demand_ta_allocations: { select: { ta_id: true } },
    },
  });
  return {
    spocId: demand?.spoc_profile_id ?? null,
    recruiterIds: (demand?.demand_ta_allocations ?? []).map((a) => a.ta_id).filter((id): id is string => !!id),
  };
}
