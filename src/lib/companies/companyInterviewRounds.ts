import { prisma } from '@/lib/db/prisma';
import { findByNormalizedName } from '@/lib/masters/masterName';

/**
 * THE single backend owner of a company's interview rounds (`company_interview_rounds`).
 *
 * Every write to company rounds in the product goes through this module — the Company module's
 * own settings route (the ONLY place existing company rounds are ever changed) and the Demand
 * create/update flows' first-time seed. Nothing else may write the table.
 *
 * The write rules this file exists to enforce:
 *
 *   - Company rounds are the canonical company-level configuration. Editing them changes what
 *     NEW demands inherit — never the rounds of demands that already exist.
 *   - A demand may write them ONLY as a first-time seed, and only when the company has zero
 *     rounds (active or inactive). There is deliberately no "replace the company's rounds" call
 *     for a demand path: the old last-saved-wins sync is gone, so a demand's own customization
 *     can never leak back into the company master.
 *   - Seeds are atomic: the company row is locked FOR UPDATE and the "still zero?" check is
 *     re-read inside the transaction, so two concurrent demand saves can never overwrite each
 *     other or clobber a configuration someone set in Clients Master meanwhile.
 *   - `replaceCompanyRounds` blocks editing the NAME or MODE of, or deleting, a round that is
 *     already in use (by a demand's materialized round, or by a candidate interview) — see
 *     `computeCompanyRoundUsage`. Reorder, the Mandatory flag and the Active/Inactive toggle stay
 *     allowed on an in-use round. This never touches a demand that already has the round: a
 *     demand keeps its own copy either way (the separate, per-demand protection for rounds that
 *     have interviews on THAT demand lives in `findInUseDemandRoundConflicts`,
 *     src/lib/demandFulfillment/interviewConfig.ts).
 */

/** Raised for anything the caller can fix in their payload (bad name, duplicate, empty list). */
export class CompanyRoundsValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CompanyRoundsValidationError';
  }
}

/** Raised when a save would delete, rename or change the mode of a round already in use. */
export class CompanyRoundInUseError extends Error {
  status = 409;
  rounds: { name: string; usage: number }[];
  constructor(rounds: { name: string; usage: number }[]) {
    super(
      `${rounds.map((r) => `"${r.name}"`).join(', ')} ${rounds.length === 1 ? 'is' : 'are'} in use and cannot be edited or deleted. Use Deactivate to stop new use.`
    );
    this.name = 'CompanyRoundInUseError';
    this.rounds = rounds;
  }
}

/** A round as supplied by a caller — by NAME, by master id, or both. */
export interface CompanyRoundInput {
  round_id?: string | null;
  name?: string | null;
  /** Optional free-text interview mode for this round. NULL/blank = not recorded. */
  mode?: string | null;
  order?: number | null;
  mandatory?: boolean | null;
  /** Default true — an existing round saved before this field existed is active. */
  isActive?: boolean | null;
}

/** A round as stored and returned. `round_id` is always a real interview_rounds master id. */
export interface CompanyRound {
  round_id: string;
  name: string;
  mode: string | null;
  order: number;
  mandatory: boolean;
  isActive: boolean;
}

/** A Prisma client usable inside these functions — the top-level client, or an already-open
 *  interactive-transaction client, derived from prisma's own $transaction signature so it can
 *  never drift out of sync with the generated types. */
export type CompanyRoundsClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Case-insensitive identity for a round name — must stay equivalent to the DB's
 *  interview_rounds normalized-name index (LOWER(TRIM(name))). */
function roundKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Validates and canonicalizes a caller-supplied round list into dense 1..n order.
 *
 * Rejects, because a stored round list is the company master and must stay clean:
 *   - a blank/empty name ("Round name is required")
 *   - two rounds whose names collide once trimmed + lowercased
 * Trims every name and rewrites `order` to a dense 1..n sequence, so a caller that sends 2,5,9
 * (or nothing at all) can never leave a gap in round_order — the table is UNIQUE on
 * (company_id, round_order), so a gap-free sequence is what keeps a reorder safe.
 */
export function normalizeCompanyRounds(rounds: CompanyRoundInput[]): CompanyRoundInput[] {
  if (rounds.length === 0) return [];

  const trimmed = rounds.map((r) => ({
    round_id: r.round_id ?? null,
    name: (r.name ?? '').trim(),
    // Mode is optional free text: trimmed, and a blank becomes NULL rather than ''.
    mode: r.mode?.trim() ? r.mode.trim() : null,
    mandatory: !!r.mandatory,
    isActive: r.isActive !== false,
  }));

  // `firstNameByKey` keeps the message anchored to the name as it was FIRST typed, so a
  // duplicate is reported against the entry the user recognises rather than the later copy.
  const firstNameByKey = new Map<string, string>();
  trimmed.forEach((round, index) => {
    if (!round.name) {
      throw new CompanyRoundsValidationError(`Interview round ${index + 1} has no name`);
    }
    const key = roundKey(round.name);
    const first = firstNameByKey.get(key);
    if (first !== undefined) {
      throw new CompanyRoundsValidationError(`"${first}" is listed more than once`);
    }
    firstNameByKey.set(key, round.name);
  });

  // The stored order is always the list's own order. A caller-supplied `order` is used to SORT
  // the list first (so a client that persisted its own order values still round-trips correctly),
  // then discarded and replaced with a dense 1..n. The array position is otherwise authoritative,
  // because that is what the drag-and-drop editor produces.
  const orderOf = (i: number) => (typeof rounds[i].order === 'number' ? rounds[i].order : i + 1);
  const indices = rounds.map((_, i) => i);
  indices.sort((a, b) => orderOf(a) - orderOf(b) || a - b);

  return indices.map((i, position) => ({ ...trimmed[i], order: position + 1 }));
}

/** A company's stored rounds, ordered. The canonical read for every consumer. */
export async function readCompanyRounds(client: CompanyRoundsClient, companyId: string): Promise<CompanyRound[]> {
  const rows = await client.company_interview_rounds.findMany({
    where: { company_id: companyId },
    orderBy: { round_order: 'asc' },
    include: { interview_rounds: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    round_id: r.round_id,
    name: r.interview_rounds.name,
    mode: r.mode ?? null,
    order: r.round_order,
    mandatory: r.mandatory,
    isActive: r.is_active,
  }));
}

/**
 * Usage of each of a company's rounds, keyed by `round_id` — how many of the company's OWN
 * demands have materialized that round (`demand_interview_rounds`, matched by master id, or by
 * case-insensitive name for a legacy row with no master link), plus a candidate-interview
 * fallback for the rare case where a demand's round row no longer exists but an interview kept
 * the round's name as a free-text snapshot (`interviews.level`). Any count above zero means the
 * round cannot be renamed, have its mode changed, or be deleted from Clients Master.
 */
export async function computeCompanyRoundUsage(
  client: CompanyRoundsClient,
  companyId: string,
  rounds: { round_id: string; name: string }[]
): Promise<Record<string, number>> {
  const usage: Record<string, number> = {};
  for (const r of rounds) usage[r.round_id] = 0;
  if (rounds.length === 0) return usage;

  const nameKeyToRoundId = new Map(rounds.map((r) => [roundKey(r.name), r.round_id]));
  const demandsByRoundId = new Map<string, Set<string>>();
  const matchedRowIds = new Set<string>();

  const demandRows = await client.demand_interview_rounds.findMany({
    where: { demands: { company_id: companyId } },
    select: { id: true, demand_id: true, name: true, master_round_id: true },
  });
  for (const row of demandRows) {
    const roundId = (row.master_round_id && row.master_round_id in usage)
      ? row.master_round_id
      : (!row.master_round_id ? nameKeyToRoundId.get(roundKey(row.name)) : undefined);
    if (!roundId) continue;
    matchedRowIds.add(row.id);
    if (!demandsByRoundId.has(roundId)) demandsByRoundId.set(roundId, new Set());
    demandsByRoundId.get(roundId)!.add(row.demand_id);
  }
  for (const [roundId, demandIds] of demandsByRoundId) usage[roundId] = demandIds.size;

  // Orphan interviews: the materialized round row is gone, but the interview still carries the
  // round's name verbatim — scoped to this company's own demands, de-duped per (round, demand)
  // so it never double-counts a demand already counted above.
  const interviews = await client.interviews.findMany({
    where: { demands: { company_id: companyId }, level: { not: null } },
    select: { round_id: true, demand_id: true, level: true },
  });
  const seenOrphan = new Set<string>();
  for (const interview of interviews) {
    if (interview.round_id && matchedRowIds.has(interview.round_id)) continue;
    if (!interview.demand_id || !interview.level) continue;
    const roundId = nameKeyToRoundId.get(roundKey(interview.level));
    if (!roundId) continue;
    const dedupeKey = `${roundId}:${interview.demand_id}`;
    if (seenOrphan.has(dedupeKey) || demandsByRoundId.get(roundId)?.has(interview.demand_id)) continue;
    seenOrphan.add(dedupeKey);
    usage[roundId] = (usage[roundId] ?? 0) + 1;
  }

  return usage;
}

/**
 * Locks the company row for the rest of the current transaction.
 *
 * Serializes concurrent writers for the SAME company (two recruiters creating demands for it at
 * once, or a demand save racing an Edit Company) so they queue instead of interleaving. The lock
 * is released on commit or rollback. This is what makes the zero-round seed check below safe.
 */
async function lockCompany(client: CompanyRoundsClient, companyId: string): Promise<void> {
  await client.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
}

/**
 * Resolves each round to a real interview_rounds master id, creating the master row when the
 * name is new (and reusing the existing one when the normalized name already matches — the
 * master is never duplicated).
 *
 * Identity is the NAME, never a caller-supplied id: a round seeded from a demand's materialized
 * rows can carry an id that is not a master id (company_interview_rounds.round_id is a real FK,
 * unlike the plain-JSON demand_interview_config.rounds), so resolving by name — creating the
 * master if needed — keeps every write FK-safe.
 */
async function resolveMasterIds(client: CompanyRoundsClient, rounds: CompanyRoundInput[]): Promise<string[]> {
  const ids: string[] = [];
  for (const round of rounds) {
    const existing = await findByNormalizedName<{ id: string; name: string }>(client.interview_rounds)(round.name!.trim());
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const created = await client.interview_rounds.create({
      data: { name: round.name!.trim(), is_active: true },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
}

/**
 * REPLACES a company's rounds with the given ordered list.
 *
 * Only the Company module's own settings route may call this — it is the one place existing
 * company rounds are allowed to change. A demand path must use seedCompanyRoundsIfEmpty instead.
 *
 * Pass `client` to join an already-open transaction (the route opens its own); omit it to have
 * this function open and manage its own. No-ops when the incoming list is already identical
 * (same names, modes, Mandatory flags and Active state, in the same order), so an unchanged save
 * writes nothing. Throws `CompanyRoundInUseError` when the save would rename, change the mode of,
 * or delete a round that is already in use (see `computeCompanyRoundUsage`).
 */
export async function replaceCompanyRounds(
  companyId: string,
  rounds: CompanyRoundInput[],
  client?: CompanyRoundsClient
): Promise<{ changed: boolean }> {
  const run = async (tx: CompanyRoundsClient): Promise<{ changed: boolean }> => {
    const normalized = normalizeCompanyRounds(rounds);
    await lockCompany(tx, companyId);

    const existing = await readCompanyRounds(tx, companyId);
    // Mode and Active state are part of a round's identity for change detection: editing only
    // one of them must still be written, otherwise the edit would silently no-op as "unchanged".
    const asComparable = (list: { name?: string | null; mode?: string | null; mandatory?: boolean | null; isActive?: boolean | null }[]) =>
      list.map((v) => ({ name: v.name ?? '', mode: v.mode ?? null, mandatory: !!v.mandatory, isActive: v.isActive !== false }));
    const next = asComparable(normalized);
    const same = (a: typeof next, b: typeof next) =>
      a.length === b.length &&
      a.every(
        (v, i) =>
          roundKey(v.name) === roundKey(b[i].name) &&
          (v.mode ?? '') === (b[i].mode ?? '') &&
          v.mandatory === b[i].mandatory &&
          v.isActive === b[i].isActive
      );
    if (same(asComparable(existing), next)) return { changed: false };

    // In-use guard: a round already used by one of this company's own demands (or a candidate
    // interview) may not be renamed, have its mode changed, or be removed from the list.
    // Reorder, Mandatory and the Active/Inactive toggle are always allowed.
    if (existing.length > 0) {
      const usage = await computeCompanyRoundUsage(tx, companyId, existing);
      const blocked = existing
        .filter((ex) => (usage[ex.round_id] ?? 0) > 0)
        .filter((ex) => {
          const match = normalized.find((n) => (n.round_id ?? null) === ex.round_id);
          return !match || roundKey(match.name ?? '') !== roundKey(ex.name) || (match.mode ?? null) !== ex.mode;
        })
        .map((ex) => ({ name: ex.name, usage: usage[ex.round_id] }));
      if (blocked.length > 0) {
        throw new CompanyRoundInUseError(blocked);
      }
    }

    await tx.company_interview_rounds.deleteMany({ where: { company_id: companyId } });
    if (normalized.length > 0) {
      const masterIds = await resolveMasterIds(tx, normalized);
      await tx.company_interview_rounds.createMany({
        data: normalized.map((round, i) => ({
          company_id: companyId,
          round_id: masterIds[i],
          round_order: round.order!,
          mandatory: !!round.mandatory,
          mode: round.mode ?? null,
          is_active: round.isActive !== false,
        })),
      });
    }
    return { changed: true };
  };

  return client ? run(client) : prisma.$transaction((tx) => run(tx));
}

/**
 * FIRST-TIME SEED — the only way a Demand path may write a company's rounds.
 *
 * Seeds the company ONLY when it still has zero rounds (active or inactive) at the moment of the
 * write (checked inside the transaction, under the company row lock). Returns `{ seeded: false }`
 * and writes nothing in every other case: the company already has rounds, or the caller sent none.
 *
 * Consequences, which are the whole point of the rule:
 *   - a company's rounds are set once, from Clients Master or from the first demand that
 *     supplies them, and are then only ever changed from Clients Master;
 *   - two concurrent demand saves can never overwrite each other — the first to commit wins
 *     and the second observes "already configured" and backs off;
 *   - customizing a demand's rounds NEVER touches the company, no matter how many times the
 *     demand is saved.
 */
export async function seedCompanyRoundsIfEmpty(
  client: CompanyRoundsClient,
  companyId: string,
  rounds: CompanyRoundInput[]
): Promise<{ seeded: boolean }> {
  const normalized = normalizeCompanyRounds(rounds);
  if (normalized.length === 0) return { seeded: false };

  await lockCompany(client, companyId);

  const existingCount = await client.company_interview_rounds.count({ where: { company_id: companyId } });
  if (existingCount > 0) return { seeded: false };

  const masterIds = await resolveMasterIds(client, normalized);
  await client.company_interview_rounds.createMany({
    data: normalized.map((round, i) => ({
      company_id: companyId,
      round_id: masterIds[i],
      round_order: round.order!,
      mandatory: !!round.mandatory,
      // The seed carries the demand round's own mode, so a company seeded from a demand starts
      // with the same modes the demand had.
      mode: round.mode ?? null,
      is_active: true,
    })),
  });
  return { seeded: true };
}
