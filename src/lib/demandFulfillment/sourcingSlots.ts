import type { Prisma } from '@/generated/prisma/client';
import { getResumeCapPerPosition } from './resumeCap';

type Db = Prisma.TransactionClient;

/** How many profiles may be Active at once: positions × the resume cap (client-level override or default 5). */
export async function activeSlotCap(numPositions: number | null | undefined, companyId?: string | null): Promise<number> {
  const perPosition = await getResumeCapPerPosition(companyId);
  return Math.max(1, numPositions ?? 1) * perPosition;
}

export async function countActiveSlots(db: Db, demandId: string): Promise<number> {
  return db.submissions.count({
    where: {
      demand_id: demandId,
      is_active: true,
      OR: [{ sourcing_type: 'active' }, { sourcing_type: null }],
    },
  });
}

/** Under the cap the upload is Active. Past the cap it is still stored, as Backup. */
export async function nextSourcingType(
  db: Db,
  demandId: string,
  numPositions: number | null | undefined,
  companyId?: string | null
): Promise<'active' | 'backup'> {
  const cap = await activeSlotCap(numPositions, companyId);
  const active = await countActiveSlots(db, demandId);
  return active >= cap ? 'backup' : 'active';
}

/** The oldest Backup becomes Active when an Active profile leaves the pipeline. */
export async function promoteNextBackup(db: Db, demandId: string, actorId?: string | null): Promise<string | null> {
  const next = await db.submissions.findFirst({
    where: { demand_id: demandId, is_active: true, sourcing_type: 'backup' },
    orderBy: { created_at: 'asc' },
    select: { id: true, current_status: true },
  });
  if (!next) return null;
  await db.submissions.update({
    where: { id: next.id },
    data: { sourcing_type: 'active', updated_at: new Date() },
  });
  await db.submission_events.create({
    data: {
      submission_id: next.id,
      event_type: 'status_change',
      from_status: next.current_status,
      to_status: next.current_status,
      content: 'Automatically promoted from Backup to Active in submission order after position slot opened',
      created_by: actorId ?? null,
    },
  });
  return next.id;
}
