import type { Prisma } from '@/generated/prisma/client';
import { getResumeCapPerPosition } from './resumeCap';

type Db = Prisma.TransactionClient;

/** How many profiles may be Active at once: positions × the resume cap (default 5). */
export async function activeSlotCap(numPositions: number | null | undefined): Promise<number> {
  const perPosition = await getResumeCapPerPosition();
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
  numPositions: number | null | undefined
): Promise<'active' | 'backup'> {
  const cap = await activeSlotCap(numPositions);
  const active = await countActiveSlots(db, demandId);
  return active >= cap ? 'backup' : 'active';
}

/** The oldest Backup becomes Active when an Active profile leaves the pipeline. */
export async function promoteNextBackup(db: Db, demandId: string): Promise<void> {
  const next = await db.submissions.findFirst({
    where: { demand_id: demandId, is_active: true, sourcing_type: 'backup' },
    orderBy: { created_at: 'asc' },
    select: { id: true },
  });
  if (!next) return;
  await db.submissions.update({ where: { id: next.id }, data: { sourcing_type: 'active' } });
}
