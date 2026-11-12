/**
 * Requirement ID (demands.request_id) generation — the `CSF-<year>-<NNNN>` scheme
 * advertised by Settings → ID Scheme (see src/app/api/settings/route.ts:
 * { prefix: 'CSF', yearFormat: 'YYYY', sequenceLength: 4 }).
 *
 * `demands.request_id` has NO database uniqueness constraint, so the ID is derived
 * from the highest sequence already used for the current year and incremented. The old
 * `Date.now().toString().slice(-4)` derivation repeated itself every 10 seconds (the
 * last four digits of an epoch-ms timestamp cycle on a 10s boundary), so two demands
 * created moments apart silently shared a Requirement ID.
 *
 * Max+1 is only unique if nobody else picks the same number concurrently, and both the
 * Demand list's "+ Add New Demand" button and bulk import can fire in parallel. A plain
 * read-then-write races: three simultaneous creates all read the same maximum and all
 * pick the same next ID. `lockDemandRequestIdSequence` closes that window with a
 * transaction-scoped PostgreSQL advisory lock, so callers generate the ID *inside* the
 * same transaction as the insert (see POST /api/demands and
 * POST /api/demands/bulk-import) — the lock is held until that transaction commits, and
 * everyone behind it then sees the committed row.
 *
 * Callers that accept a user-supplied ID should also call `isDemandRequestIdTaken` to
 * reject an explicit duplicate up front; POST /api/demands does.
 */

import { prisma } from '@/lib/db/prisma';

/** Just enough of the Prisma client for the queries below — satisfied by both the
 *  module-level `prisma` and the `tx` handle Prisma hands to an interactive transaction. */
type DemandIdClient = Pick<typeof prisma, 'demands' | '$queryRaw' | '$executeRaw'>;

/** Arbitrary but fixed key for the advisory lock (any stable constant works). */
const DEMAND_REQUEST_ID_LOCK_KEY = '728114031';

/** Builds the constant prefix for a year, e.g. `CSF-2026-`. */
export function demandRequestIdPrefix(year = new Date().getFullYear()): string {
  return `CSF-${year}-`;
}

/** The 4-digit sequence part, or null when it isn't one (e.g. a manual "REQ-12"). Case-insensitive. */
export function parseDemandRequestIdSequence(requestId: string, year = new Date().getFullYear()): number | null {
  const prefix = demandRequestIdPrefix(year);
  if (requestId.toUpperCase().slice(0, prefix.length) !== prefix) return null;
  const seq = Number.parseInt(requestId.slice(prefix.length), 10);
  return Number.isInteger(seq) && seq >= 0 ? seq : null;
}

// Case-insensitive so a lowercase legacy ID still counts as taken.
export async function isDemandRequestIdTaken(
  requestId: string,
  client: DemandIdClient = prisma,
  excludeDemandId?: string
): Promise<boolean> {
  const existing = await client.demands.findFirst({
    where: { request_id: { equals: requestId, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!existing) return false;
  return excludeDemandId ? existing.id !== excludeDemandId : true;
}

/**
 * Serializes Requirement-ID generation across concurrent creates. MUST be called inside
 * the same interactive transaction as the eventual `demands.create` — `pg_advisory_xact_lock`
 * is released at that transaction's end, so outside one it would lock nothing.
 */
export async function lockDemandRequestIdSequence(tx: DemandIdClient): Promise<void> {
  // $executeRaw, not $queryRaw: pg_advisory_xact_lock returns void, which Prisma's raw
  // deserializer rejects ("Failed to deserialize column of type 'void'").
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DEMAND_REQUEST_ID_LOCK_KEY}::bigint)`;
}

/**
 * A fresh Requirement ID that does not currently exist. Pass the transaction client when
 * the insert is about to happen inside a transaction that already took
 * `lockDemandRequestIdSequence`.
 */
export async function generateDemandRequestId(client: DemandIdClient = prisma): Promise<string> {
  const prefix = demandRequestIdPrefix();

  const sameYear = await client.demands.findMany({
    // Case-insensitive so a legacy lowercase row still contributes its sequence number.
    where: { request_id: { startsWith: prefix, mode: 'insensitive' } },
    select: { request_id: true },
  });

  let highest = 0;
  for (const row of sameYear) {
    const seq = parseDemandRequestIdSequence(row.request_id);
    if (seq !== null && seq > highest) highest = seq;
  }

  let next = highest + 1;
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = `${prefix}${String(next).padStart(4, '0')}`;
    if (!(await isDemandRequestIdTaken(candidate, client))) return candidate;
    next++;
  }

  // The guarantee is "never returns an ID that already exists", so the fallback loops too.
  const fallbackBase = `${prefix}${String(Date.now()).slice(-8)}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = `${fallbackBase}${attempt === 0 ? '' : attempt}`;
    if (!(await isDemandRequestIdTaken(candidate, client))) return candidate;
  }
  throw new Error('Could not generate a unique Requirement ID');
}
