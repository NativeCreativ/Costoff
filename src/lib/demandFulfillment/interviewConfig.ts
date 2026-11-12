import { prisma } from '@/lib/db/prisma';
import { findByNormalizedName } from '@/lib/masters/masterName';
import { readCompanyRounds } from '@/lib/companies/companyInterviewRounds';
import { HARDCODED_DEFAULT_INTERVIEW_ROUNDS, HARDCODED_DEFAULT_INTERVIEW_MODES, SUPER_ADMIN_SETTINGS_KEYS, normalizeInterviewModes } from './constants';
import type { InterviewRound, MaterializedInterviewRound } from '@/components/types';

/** Case-insensitive identity for a round name. Must stay equivalent to the DB's
 *  interview_rounds_normalized_name_key (LOWER(TRIM(name))). */
function roundKey(name: string): string {
  return name.trim().toLowerCase();
}

/** A Prisma client usable by the demand-round helpers — either the top-level client or an
 *  already-open interactive-transaction client, derived directly from prisma's own $transaction
 *  signature so it can never drift out of sync with the generated types. */
type PrismaDemandRoundsClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Returns the demand's company_id, or null when it has no company yet (pre-backfill rows). */
async function getDemandCompanyId(demandId: string): Promise<string | null> {
  const demand = await prisma.demands.findUnique({ where: { id: demandId }, select: { company_id: true } });
  return demand?.company_id ?? null;
}


async function resolveConfiguredRounds(demandId: string): Promise<InterviewRound[]> {
  const demandConfig = await prisma.demand_interview_config.findUnique({ where: { demand_id: demandId } });
  if (demandConfig?.rounds && Array.isArray(demandConfig.rounds) && demandConfig.rounds.length > 0) {
    return demandConfig.rounds as unknown as InterviewRound[];
  }

  const companyId = await getDemandCompanyId(demandId);
  if (companyId) {
    const companyRounds = await prisma.company_interview_rounds.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { round_order: 'asc' },
      include: { interview_rounds: { select: { name: true } } },
    });
    if (companyRounds.length > 0) {
      return companyRounds.map((r) => ({
        name: r.interview_rounds.name,
        mode: r.mode ?? null,
        order: r.round_order,
        mandatory: r.mandatory,
      }));
    }
  }

  const globalConfig = await prisma.super_admin_settings.findUnique({
    where: { key: SUPER_ADMIN_SETTINGS_KEYS.interviewRoundsDefault },
  });
  if (globalConfig?.value && Array.isArray(globalConfig.value) && globalConfig.value.length > 0) {
    return globalConfig.value as unknown as InterviewRound[];
  }

  return HARDCODED_DEFAULT_INTERVIEW_ROUNDS;
}

/**
 * Reads a company's configured interview rounds, shaped like the demand-level JSON so a
 * Demand Create/Edit form can seed itself from it. Returns [] when the company has no
 * configuration (or no company), which callers treat as "no company rounds yet — fall back to
 * the global default, and seed this company on first save".
 *
 * Delegates to the single canonical company-rounds store
 * (src/lib/companies/companyInterviewRounds.ts) rather than querying company_interview_rounds
 * itself, so there is exactly one reader of that table.
 */
export async function resolveCompanyInterviewRounds(companyId: string | null | undefined): Promise<InterviewRound[]> {
  if (!companyId) return [];
  const rows = await readCompanyRounds(prisma, companyId);
  return rows.filter((r) => r.isActive).map((r) => ({ name: r.name, mode: r.mode, order: r.order, mandatory: r.mandatory }));
}

export async function syncMaterializedRounds(demandId: string, rounds: InterviewRound[]): Promise<MaterializedInterviewRound[]> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.demand_interview_rounds.findMany({ where: { demand_id: demandId } });
    const existingByName = new Map(existing.map((r) => [roundKey(r.name), r]));
    const desiredNames = new Set(rounds.map((r) => roundKey(r.name)));

    const toDelete = existing.filter((r) => !desiredNames.has(roundKey(r.name)));
    if (toDelete.length > 0) {
      await tx.demand_interview_rounds.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
    }

    // Resolve each configured name to its master round (once per name), so the materialized
    // rows carry the master_round_id back-link and never a private string.
    const masterByName = new Map<string, string | null>();
    for (const round of rounds) {
      const key = roundKey(round.name);
      if (masterByName.has(key)) continue;
      const master = await findByNormalizedName<{ id: string; name: string }>(tx.interview_rounds)(round.name);
      masterByName.set(key, master?.id ?? null);
    }

    // Phase A — park every row that survives on a negative "temporary" order. Done BEFORE any
    // create or final-order write, because demand_interview_rounds is UNIQUE(demand_id,
    // round_order): while a kept row still sits on its old positive order, moving another row
    // onto that same number would abort the whole transaction. Parking everything negative
    // first makes every subsequent order write collision-free, regardless of how the caller
    // reordered the list (this is what makes drag-and-drop safe).
    const rowIdByIndex = new Map<number, string>();
    let parked = 0;
    for (let i = 0; i < rounds.length; i++) {
      const prev = existingByName.get(roundKey(rounds[i].name));
      if (!prev) continue;
      parked += 1;
      rowIdByIndex.set(i, prev.id);
      await tx.demand_interview_rounds.update({
        where: { id: prev.id },
        data: { round_order: -parked },
      });
    }

    // Phase B — create the newly-configured rows, continuing the negative numbering below the
    // parked survivors so no create can collide either.
    for (let i = 0; i < rounds.length; i++) {
      const key = roundKey(rounds[i].name);
      if (existingByName.has(key)) continue;
      parked += 1;
      const created = await tx.demand_interview_rounds.create({
        data: {
          demand_id: demandId,
          name: rounds[i].name.trim(),
          mode: rounds[i].mode?.trim() ? rounds[i].mode!.trim() : null,
          mandatory: !!rounds[i].mandatory,
          master_round_id: masterByName.get(key) ?? null,
          round_order: -parked,
        },
      });
      rowIdByIndex.set(i, created.id);
    }

    // Phase C — everything is now on a negative order, so writing the final 1..n orders one at
    // a time can never violate the unique index.
    for (let i = 0; i < rounds.length; i++) {
      const rowId = rowIdByIndex.get(i);
      if (!rowId) continue;
      await tx.demand_interview_rounds.update({
        where: { id: rowId },
        data: {
          round_order: i + 1,
          mode: rounds[i].mode?.trim() ? rounds[i].mode!.trim() : null,
          mandatory: !!rounds[i].mandatory,
          master_round_id: masterByName.get(roundKey(rounds[i].name)) ?? null,
        },
      });
    }

    return tx.demand_interview_rounds.findMany({
      where: { demand_id: demandId },
      orderBy: { round_order: 'asc' },
    });
  });
}

 export async function resolveInterviewRounds(demandId: string): Promise<MaterializedInterviewRound[]> {
  const existing = await prisma.demand_interview_rounds.findMany({
    where: { demand_id: demandId },
    orderBy: { round_order: 'asc' },
  });
  if (existing.length > 0) return existing;

  const configured = await resolveConfiguredRounds(demandId);
  if (configured.length === 0) return [];
  return syncMaterializedRounds(demandId, configured);
}

/**
 * This demand's OWN materialized rounds, exactly as stored — never the company/global/hardcoded
 * fallback chain `resolveInterviewRounds` applies, and never a write (no auto-seed). The global
 * Interviews & Schedules screen (Schedule/Edit Interview) uses this: a demand with zero rounds of
 * its own must show "no rounds configured" there, not silently inherit and materialize the
 * company's or the global default's rounds the way the Demand/Pipeline forms are allowed to.
 */
export async function getDemandOwnInterviewRounds(demandId: string): Promise<MaterializedInterviewRound[]> {
  return prisma.demand_interview_rounds.findMany({
    where: { demand_id: demandId },
    orderBy: { round_order: 'asc' },
  });
}

/** Per-round count of interviews scheduled against THIS demand's materialized rounds — used to
 *  lock a round from rename/delete in the Edit Demand form once interviews exist for it. */
export async function countDemandRoundInterviews(demandId: string): Promise<Record<string, number>> {
  const rows = await prisma.interviews.groupBy({
    by: ['round_id'],
    where: { demand_interview_rounds: { demand_id: demandId } },
    _count: { _all: true },
  });
  const byRoundId: Record<string, number> = {};
  for (const row of rows) {
    if (row.round_id) byRoundId[row.round_id] = row._count._all;
  }
  return byRoundId;
}

/** One round as submitted by a demand save, in the shape the Edit Demand form sends it. */
export interface IncomingDemandRound {
  /** The materialized row this entry continues — see findInUseDemandRoundConflicts. */
  row_id?: string | null;
  /** The interview_rounds MASTER id (what company_interview_rounds/demand_interview_rounds link to). */
  round_id?: string | null;
  name: string;
}

/** A round that cannot be deleted or renamed because interviews exist against it on this demand. */
export interface InUseDemandRound {
  name: string;
  interviews: number;
}

/**
 * Finds the rounds of THIS demand that a save would delete or rename while interviews exist
 * against them. Reorder and Mandatory changes never appear here — they keep the same row.
 *
 * Matching is by STABLE ID, not by name, and that is the whole point:
 *
 *   - identity is the materialized row id (`demand_interview_rounds.id`) — exactly what
 *     `interviews.round_id` points at, so "is this round in use?" is a fact about rows, not
 *     about labels a user is free to retype;
 *   - a RENAME is detected as "the same row came back under a different name", which a
 *     name-keyed diff would miss entirely if the new name were typed to match nothing else;
 *   - DELETE + RE-ADD of the same name in one save is also caught: the re-added entry carries
 *     `row_id: null`, so it matches no existing row and the original is treated as removed.
 *     Name matching alone would see the name still present and wave the edit through.
 *
 * `client` may be an open transaction so the check reads the same snapshot the save writes to —
 * that is what makes "an interview was created while you were editing" a rejection rather than a
 * silently orphaned interview.
 *
 * Only THIS demand's interviews count. The same round name in use by another demand, or by
 * another company, is irrelevant and must never block an edit here.
 *
 * Clients that don't send `row_id` at all (older payloads) fall back to matching on the master
 * id and then the normalized name, so their behaviour is unchanged.
 */
export async function findInUseDemandRoundConflicts(
  client: PrismaDemandRoundsClient,
  demandId: string,
  incoming: IncomingDemandRound[]
): Promise<InUseDemandRound[]> {
  const existing = await client.demand_interview_rounds.findMany({
    where: { demand_id: demandId },
    select: { id: true, name: true, master_round_id: true },
  });
  if (existing.length === 0) return [];

  // One query for the whole demand instead of a groupBy per round. An interview counts as using
  // a round when it points at that round's row, OR when it has no row at all (legacy rows saved
  // before rounds were materialized) and carries the round's name as its level. Scoped to this
  // demand by construction.
  const interviews = await client.interviews.findMany({
    where: {
      OR: [
        { demand_id: demandId },
        { round_id: { in: existing.map((r) => r.id) } },
      ],
    },
    select: { round_id: true, level: true },
  });

  const existingById = new Map(existing.map((r) => [r.id, r]));
  const countByRowId = new Map<string, number>();
  const countByLevelKey = new Map<string, number>();
  for (const interview of interviews) {
    if (interview.round_id && existingById.has(interview.round_id)) {
      countByRowId.set(interview.round_id, (countByRowId.get(interview.round_id) ?? 0) + 1);
      continue;
    }
    // No usable row link — fall back to the level name so a legacy interview still protects its
    // round rather than letting the round be renamed out from under it.
    const levelKey = roundKey(interview.level ?? '');
    if (levelKey && existing.some((r) => roundKey(r.name) === levelKey)) {
      countByLevelKey.set(levelKey, (countByLevelKey.get(levelKey) ?? 0) + 1);
    }
  }

  const interviewsFor = (row: { id: string; name: string }) =>
    (countByRowId.get(row.id) ?? 0) + (countByLevelKey.get(roundKey(row.name)) ?? 0);

  // A payload that carries row ids anywhere is a modern client and is matched strictly by row
  // id. `row_id: null` then means "a new round", which is exactly what makes delete-then-re-add
  // visible. A payload with no row_id field at all is an older client, matched leniently.
  const strictByRowId = incoming.some((r) => r.row_id !== undefined);

  const matchOf = (row: (typeof existing)[number]) => {
    if (strictByRowId) return incoming.find((r) => r.row_id === row.id) ?? null;
    return (
      incoming.find((r) => r.round_id && (r.round_id === row.master_round_id || r.round_id === row.id)) ??
      incoming.find((r) => roundKey(r.name) === roundKey(row.name)) ??
      null
    );
  };

  const conflicts: InUseDemandRound[] = [];
  for (const row of existing) {
    const interviews = interviewsFor(row);
    if (interviews === 0) continue; // unused rounds can always be deleted or renamed

    const match = matchOf(row);
    // No incoming entry continues this row -> it is being deleted (or was deleted and re-added
    // under the same name). A match whose name changed -> it is being renamed. Both are blocked.
    const isRemoved = match === null;
    const isRenamed = match !== null && roundKey(match.name) !== roundKey(row.name);
    if (isRemoved || isRenamed) {
      conflicts.push({ name: row.name, interviews });
    }
  }
  return conflicts;
}

/** Human-readable, single-line reason for a blocked round — surfaced verbatim in the API's 409. */
export function describeInUseDemandRound(round: InUseDemandRound): string {
  return `'${round.name}' already has ${round.interviews} interview${round.interviews === 1 ? '' : 's'} in this demand, so it cannot be deleted or renamed.`;
}

/** Interview mode options: super_admin_settings (Super Admin-configurable) -> hardcoded fallback. */
export async function resolveInterviewModes(): Promise<string[]> {
  const setting = await prisma.super_admin_settings.findUnique({
    where: { key: SUPER_ADMIN_SETTINGS_KEYS.interviewModeOptions },
  });
  const modes = normalizeInterviewModes(setting?.value ?? HARDCODED_DEFAULT_INTERVIEW_MODES);
  const active = modes.filter((m) => m.isActive).map((m) => m.name);
  return active.length > 0 ? active : modes.map((m) => m.name);
}