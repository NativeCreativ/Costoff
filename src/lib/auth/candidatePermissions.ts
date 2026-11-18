/**
 * Candidate-level permissions, shared by the candidate API routes (enforcement) and
 * the UI (show/hide).
 *
 * Relationship: Candidate -> Submission -> Demand -> Recruiter (`ta`). A candidate is
 * reachable by a recruiter when at least one of its submissions belongs to a demand
 * that recruiter is allocated to (`demand_ta_allocations`, surfaced as
 * DemandContext.recruiterIds by loadDemandContext — the same source the demand list
 * and demand-detail routes already trust).
 *
 * The role matrix deliberately mirrors canViewDemand in ./demandPermissions so the
 * two modules cannot drift:
 *   - super_admin / account_manager / hr / viewer : every candidate (read-only for
 *     hr + viewer, which cannot write because CANDIDATE_WRITE_ROLES excludes them)
 *   - spoc : candidates on demands where they are the SPOC
 *   - ta    : candidates on demands they are allocated to
 *
 * Scoping is based on the EXISTENCE of a submission to an accessible demand. It
 * deliberately does not filter on submissions.is_active / current_status /
 * final_result: those record pipeline history (rejected / dropped / backed out), not
 * ownership, and the app deliberately keeps rejected candidates eligible for other
 * demands — see SearchExistingCandidateModal ("informational only, not a blocker").
 * Filtering on is_active would hide a candidate a recruiter sourced from the very
 * picker that exists to find them.
 */

import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@/generated/prisma/client';
import { rawIdentifier } from '@/lib/auth/rawSqlIdentifier';
import { canEditAsRecordCreator, creatorEditBlockMessage } from '@/lib/auth/creatorScope';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import {
  CANDIDATE_READ_ALL_ROLES,
  CANDIDATE_DEMAND_VIEW_ALL_ROLES,
  CANDIDATE_WRITE_ROLES,
  MASTER_POOL_CREATE_ROLES,
} from '@/lib/auth/recordPermissions';

/**
 * Role constants live in ./recordPermissions (prisma-free, so client components can import
 * them too) and are re-exported here purely for the existing server call sites. One
 * definition, so the UI and the API can never disagree about who may write.
 */
export {
  CANDIDATE_READ_ALL_ROLES,
  CANDIDATE_DEMAND_VIEW_ALL_ROLES,
  CANDIDATE_WRITE_ROLES,
  MASTER_POOL_CREATE_ROLES,
} from '@/lib/auth/recordPermissions';

/**
 * Roles that may read every candidate **of a given Demand**.
 *
 * This is the DEMAND-level gate, deliberately narrower than CANDIDATE_READ_ALL_ROLES: it also
 * decides who may CREATE in a demand's pipeline, so `ta` must NOT be admitted here even though
 * a recruiter can read every candidate. Merging the two sets would turn "recruiters can see
 * all candidates" into "recruiters can edit all candidates" — do not.
 *
 * `account_manager` is also excluded: an AM still SEES every Demand (governed by
 * DEMAND_VIEW_ALL_ROLES in ./demandPermissions, unchanged), but candidate access for an AM is
 * scoped to the demands they own, per the RBAC spec. The AM case is handled explicitly in
 * canAccessCandidateDemand / buildCandidateScopeFilter using the same ownership rule as
 * isDemandOwner (created_by / contact_profile_id).
 */
export const CANDIDATE_VIEW_ALL_ROLES = CANDIDATE_DEMAND_VIEW_ALL_ROLES;

interface CandidateActor {
  role?: string | null;
  id?: string | null;
}

/** A demand a candidate is attached to, reduced to the fields the matrix needs. */
export interface CandidateDemandScope {
  demand_id: string;
  created_by: string | null;
  contact_profile_id: string | null;
  spoc_profile_id: string | null;
  /** TAs allocated to the demand (demand_ta_allocations). */
  recruiter_ids: string[];
  /**
   * Profiles that brought this candidate INTO this demand's pipeline
   * (submissions.added_by, falling back to candidates.added_by for legacy rows whose
   * submission has no adder recorded), each paired with whether that profile is a
   * Recruiter. The role matters: an Account Manager or Super Admin adder must NOT be
   * treated as "the creator has left this demand" — it means there is no recruiter
   * creator at all. See canEditCandidateDemand and ../../auth/creatorScope.
   */
  adders: { id: string; is_recruiter: boolean }[];
}

export interface CandidateAccessContext {
  candidateId: string;
  demands: CandidateDemandScope[];
  /** candidates.added_by — who put the profile in the database. Grants the creator read and
   *  edit on a candidate that is in no demand (a master-pool entry). */
  added_by?: string | null;
}

/**
 * Row-level read/write access to ONE of a candidate's demands. Split out from
 * canAccessCandidate so a caller can also ask "which of this candidate's demands may I
 * see?" — needed to scope the Candidate 360 sub-collections (interviews / offers /
 * onboardings), which are demand-specific and must never surface another demand's rows
 * to a recruiter who happens to share the candidate.
 */
export function canAccessCandidateDemand(
  actor: CandidateActor,
  demand: CandidateDemandScope
): boolean {
  if (!actor.role) return false;
  if (CANDIDATE_VIEW_ALL_ROLES.includes(actor.role)) return true;
  const actorId = actor.id;
  if (!actorId) return false;
  if (actor.role === 'spoc') return demand.spoc_profile_id === actorId;
  if (actor.role === 'ta') return demand.recruiter_ids.includes(actorId);
  if (actor.role === 'account_manager') {
    // NOTE: deliberately creator-OR-current-AM, unlike the "manage pipeline" write actions
    // (canManageDemandPipeline et al in demandFulfillmentPermissions.ts, which are current-AM
    // only). This predicate also gates plain VIEW (via canAccessCandidate), and must stay in
    // lockstep with buildCandidateScopeFilter's list-visibility query below it in this same
    // file (explicitly kept as "one Prisma clause so the list and the by-id rules cannot
    // drift") — narrowing just this one would let a candidate appear in an AM's list yet 403
    // when opened. If creator-vs-current-AM view access needs revisiting, change both
    // together, matching isDemandOwner's model in demandPermissions.ts.
    return demand.created_by === actorId || demand.contact_profile_id === actorId;
  }
  return false;
}

/**
 * EDIT/DELETE access to one of a candidate's demands.
 *
 * This is deliberately STRICTER than canAccessCandidateDemand (which grants VIEW + CREATE) and
 * stricter still than canAccessCandidate (which for a recruiter now grants reading ANY
 * candidate). The role matrix is split in two:
 *
 *   candidate read      ->  everyone with the read role set (recruiters see the whole pool)
 *   demand assignment   ->  create
 *   creator ownership   ->  edit + delete
 *
 * So two recruiters allocated to the same demand both see and both add candidates, but only
 * the recruiter who brought a given candidate into that demand's pipeline may edit or archive
 * it — even though both can open the candidate's detail page. A candidate an Account Manager
 * or Super Admin created has no recruiter creator, so the assigned recruiters get
 * view + create only.
 *
 * The full decision — including the "creator has left the demand" fallback — lives in
 * canEditAsRecordCreator, shared with the interview/pipeline paths so they cannot drift.
 *
 * Non-`ta` roles are unchanged: super_admin is unrestricted, account_manager keeps its
 * existing own-demand rule, and spoc/hr/viewer remain read-only via CANDIDATE_WRITE_ROLES.
 */
export function canEditCandidateDemand(
  actor: CandidateActor,
  demand: CandidateDemandScope
): boolean {
  if (!actor.role) return false;
  if (!CANDIDATE_WRITE_ROLES.includes(actor.role)) return false;
  if (!canAccessCandidateDemand(actor, demand)) return false;
  // Only `ta` is restricted by creator — the other write roles keep their own rules.
  if (actor.role !== 'ta') return true;
  if (!actor.id) return false;
  return demand.adders.some((a) =>
    canEditAsRecordCreator({
      actorId: actor.id!,
      creatorId: a.id,
      creatorIsRecruiter: a.is_recruiter,
      currentRecruiterIds: demand.recruiter_ids,
    })
  );
}

/** A human-readable reason why edit was denied, for the 403 body and UI tooltips. */
export function candidateEditBlockReason(
  actor: CandidateActor,
  ctx: { demands: CandidateDemandScope[] }
): string | null {
  if (canEditCandidate(actor, ctx)) return null;
  const reason = ctx.demands.flatMap((d) => d.adders.map((a) => creatorEditBlockMessage({
    actorId: actor.id || '',
    creatorId: a.id,
    creatorIsRecruiter: a.is_recruiter,
    currentRecruiterIds: d.recruiter_ids,
  }, 'candidate')));
  // Prefer the explanation that names a real recruiter, since that is the more specific case.
  return reason.find((r) => /another recruiter/i.test(r)) ?? reason[0] ?? null;
}

/**
 * Row-level READ access to a single candidate.
 *
 * "Accessible" means the actor may see the candidate record. Recruiters read ALL candidates
 * (CANDIDATE_READ_ALL_ROLES) because they work from the shared pool and must be able to look
 * up a profile another recruiter sourced; everyone else reads within their Demand scope.
 *
 * This answers "can I see it" ONLY. Whether the actor may CHANGE it is a separate, stricter
 * question answered by canEditCandidate — do not collapse the two.
 */
export function canAccessCandidate(
  actor: CandidateActor,
  ctx: { demands: CandidateDemandScope[]; added_by?: string | null }
): boolean {
  if (!actor.role) return false;
  if (CANDIDATE_READ_ALL_ROLES.includes(actor.role)) return true;
  // The person who added the candidate always sees it (AM master-pool entries).
  if (actor.id && ctx.added_by && ctx.added_by === actor.id && CANDIDATE_WRITE_ROLES.includes(actor.role)) return true;
  return ctx.demands.some((d) => canAccessCandidateDemand(actor, d));
}

/**
 * EDIT/DELETE access to a single candidate: true when the actor may edit it in the
 * context of at least one demand it is attached to (canEditCandidateDemand).
 *
 * Uses the DEMAND-level rule, never canAccessCandidate — a recruiter may read a candidate
 * system-wide but can still only edit one they brought into a demand they are assigned to.
 */
export function canEditCandidate(
  actor: CandidateActor,
  ctx: { demands: CandidateDemandScope[]; added_by?: string | null }
): boolean {
  if (!actor.role) return false;
  if (ctx.demands.length === 0) {
    // Master-pool candidate with no submissions: Super Admin, or whoever added it (a Recruiter
    // or AM — MASTER_POOL_CREATE_ROLES). Once it is in a demand, the demand rules below apply.
    if (actor.role === 'super_admin') return true;
    return !!actor.id && !!ctx.added_by && ctx.added_by === actor.id && MASTER_POOL_CREATE_ROLES.includes(actor.role);
  }
  return ctx.demands.some((d) => canEditCandidateDemand(actor, d));
}

/**
 * The subset of a candidate's demand ids this actor may see IN THE PIPELINE SENSE.
 *
 * Deliberately uses the demand-level rule (canAccessCandidateDemand), NOT canAccessCandidate:
 * this scopes demand-specific child records (interviews, offers, onboardings) in the Candidate
 * 360 drawer, which are demand-specific and must never surface another demand's rows. Since a
 * recruiter can now READ every candidate, using the read rule here would leak the interviews,
 * offers and onboarding records of demands they are not assigned to.
 */
export function accessibleDemandIdsForCandidate(
  actor: CandidateActor,
  ctx: { demands: CandidateDemandScope[] }
): string[] {
  return ctx.demands.filter((d) => canAccessCandidateDemand(actor, d)).map((d) => d.demand_id);
}

/**
 * Loads, from the database, every demand the candidate is attached to via a
 * submission. `id`, `candidate_id`, `requestId` etc. coming from a request body are
 * never trusted for authorization — this is the only source of truth.
 */
export async function loadCandidateAccessContext(candidateId: string): Promise<CandidateAccessContext | null> {
  const candidate = await prisma.candidates.findUnique({
    where: { id: candidateId },
    select: { id: true, added_by: true },
  });
  if (!candidate) return null;

  const submissions = await prisma.submissions.findMany({
    where: { candidate_id: candidateId },
    select: {
      added_by: true,
      demands: {
        select: {
          id: true,
          created_by: true,
          contact_profile_id: true,
          spoc_profile_id: true,
          demand_ta_allocations: { select: { ta_id: true } },
        },
      },
    },
  });

  // A candidate may be attached to the same demand by more than one profile, so the
  // per-demand adder is a list. Legacy submission rows with no `added_by` fall back to
  // the candidate's global creator so they are not treated as unowned.
  const raw = submissions
    .filter((s) => s.demands)
    .map((s) => ({ demand: s.demands!, adder: s.added_by ?? candidate.added_by }));
  const recruiterIds = await recruiterProfileIds(raw.map((r) => r.adder));

  const byDemand = new Map<string, CandidateDemandScope>();
  for (const { demand: d, adder } of raw) {
    const existing = byDemand.get(d.id);
    if (existing) {
      if (adder && !existing.adders.some((a) => a.id === adder)) {
        existing.adders.push({ id: adder, is_recruiter: recruiterIds.has(adder) });
      }
      continue;
    }
    byDemand.set(d.id, {
      demand_id: d.id,
      created_by: d.created_by,
      contact_profile_id: d.contact_profile_id,
      spoc_profile_id: d.spoc_profile_id,
      recruiter_ids: d.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id),
      adders: adder ? [{ id: adder, is_recruiter: recruiterIds.has(adder) }] : [],
    });
  }

  return { candidateId, demands: [...byDemand.values()], added_by: candidate.added_by };
}

/**
 * Batched form of loadCandidateAccessContext for list endpoints: one extra query for the
 * whole page instead of a per-row round trip. Candidates with no submission are still
 * present in the result (with an empty `demands` array) so the caller can rely on the map
 * being complete.
 */
export async function loadCandidateAccessContexts(
  candidateIds: string[]
): Promise<Map<string, CandidateAccessContext>> {
  const out = new Map<string, CandidateAccessContext>();
  if (candidateIds.length === 0) return out;

  const candidates = await prisma.candidates.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, added_by: true },
  });
  for (const c of candidates) out.set(c.id, { candidateId: c.id, demands: [], added_by: c.added_by });

  const submissions = await prisma.submissions.findMany({
    where: { candidate_id: { in: candidateIds } },
    select: {
      candidate_id: true,
      added_by: true,
      demands: {
        select: {
          id: true,
          created_by: true,
          contact_profile_id: true,
          spoc_profile_id: true,
          demand_ta_allocations: { select: { ta_id: true } },
        },
      },
    },
  });

  const byCandidate = new Map<string, CandidateAccessContext>();
  for (const c of candidates) byCandidate.set(c.id, { candidateId: c.id, demands: [], added_by: c.added_by });

  const globalAdder = new Map(candidates.map((c) => [c.id, c.added_by]));
  const rows = submissions.filter((s) => s.candidate_id && s.demands)
    .map((s) => ({ candidateId: s.candidate_id!, demand: s.demands!, adder: s.added_by ?? globalAdder.get(s.candidate_id!) ?? null }));
  const recruiterIds = await recruiterProfileIds(rows.map((r) => r.adder));

  for (const { candidateId, demand: d, adder } of rows) {
    const ctx = byCandidate.get(candidateId);
    if (!ctx) continue; // candidate no longer exists
    const existing = ctx.demands.find((x) => x.demand_id === d.id);
    if (existing) {
      if (adder && !existing.adders.some((a) => a.id === adder)) {
        existing.adders.push({ id: adder, is_recruiter: recruiterIds.has(adder) });
      }
      continue;
    }
    ctx.demands.push({
      demand_id: d.id,
      created_by: d.created_by,
      contact_profile_id: d.contact_profile_id,
      spoc_profile_id: d.spoc_profile_id,
      recruiter_ids: d.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id),
      adders: adder ? [{ id: adder, is_recruiter: recruiterIds.has(adder) }] : [],
    });
  }

  return byCandidate;
}

/** Convenience wrapper: does this actor reach this candidate? */
export async function canAccessCandidateById(actor: CandidateActor, candidateId: string): Promise<boolean> {
  const ctx = await loadCandidateAccessContext(candidateId);
  if (!ctx) return false;
  return canAccessCandidate(actor, ctx);
}

/**
 * Raw-SQL sibling of buildCandidateScopeFilter — the exact same read rules,
 * expressed for `$queryRaw` aggregation queries (the dashboard) where a
 * Prisma where-input cannot be spread in. `alias` is the candidates table
 * alias. Returns Prisma.empty when the actor may read every candidate, and
 * Prisma.sql`FALSE` for unknown roles (fail closed, matching
 * buildCandidateScopeFilter).
 */
export function buildCandidateVisibilityCondition(
  actor: CandidateActor,
  alias = 'candidates',
): Prisma.Sql {
  if (!actor.role) return Prisma.sql`FALSE`;
  if (CANDIDATE_READ_ALL_ROLES.includes(actor.role)) return Prisma.empty;

  // `alias` is an identifier, not a bind value — see rawSqlIdentifier. Without
  // Prisma.raw it is sent as a parameter and PostgreSQL fails on `'candidates'.id`.
  const a = rawIdentifier(alias);

  if (actor.role === 'spoc') {
    return Prisma.sql`EXISTS (
      SELECT 1 FROM submissions s
      JOIN demands d ON d.id = s.demand_id
      WHERE s.candidate_id = ${a}.id AND d.spoc_profile_id = ${actor.id}::uuid
    )`;
  }

  // Account Manager: candidates on demands they own (created_by /
  // contact_profile_id) — the same predicate isDemandOwner uses.
  if (actor.role === 'account_manager') {
    return Prisma.sql`(${a}.added_by = ${actor.id}::uuid OR EXISTS (
      SELECT 1 FROM submissions s
      JOIN demands d ON d.id = s.demand_id
      WHERE s.candidate_id = ${a}.id
        AND (d.created_by = ${actor.id}::uuid OR d.contact_profile_id = ${actor.id}::uuid)
    ))`;
  }

  return Prisma.sql`FALSE`;
}

/**
 * Restricts a candidates-table query to the rows this actor may see, for the roles that are
 * assignment-scoped (spoc, account_manager). Returns null when the actor may see everything, so
 * callers can spread it into a `where` unchanged.
 *
 * Returns null for `ta` — Recruiters see the COMPLETE candidate pool (CANDIDATE_READ_ALL_ROLES),
 * deliberately NOT filtered by demand assignment or by created_by: a Recruiter must be able to
 * find another Recruiter's candidate. Mutation is not affected by this; every write route
 * independently re-derives demand assignment + creator ownership.
 *
 * Note super_admin is included in the "see everything" branch here rather than being
 * left to the route's role gate: requireRole() in ./session lets super_admin through
 * for ANY role list, so the route gate cannot be relied on to scope reads. Scoping
 * every role through this one helper keeps the list and the by-id rules identical.
 */
export async function buildCandidateScopeFilter(actor: CandidateActor): Promise<Prisma.candidatesWhereInput | null> {
  if (!actor.role) return { id: { in: [] } }; // fail closed
  if (CANDIDATE_READ_ALL_ROLES.includes(actor.role)) return null;

  if (actor.role === 'spoc') {
    if (!actor.id) return { id: { in: [] } };
    return {
      submissions: { some: { demands: { spoc_profile_id: actor.id } } },
    };
  }

  // Account Manager: candidates on demands they own (created_by / contact_profile_id) —
  // the same predicate isDemandOwner uses, kept in one Prisma clause so the list and
  // the by-id rules cannot drift.
  if (actor.role === 'account_manager') {
    if (!actor.id) return { id: { in: [] } };
    return {
      OR: [
        { submissions: { some: { demands: { OR: [{ created_by: actor.id }, { contact_profile_id: actor.id }] } } } },
        // Candidates the AM added to the database themselves (with or without a demand).
        { added_by: actor.id },
      ],
    };
  }

  // Unknown role — fail closed, consistent with buildDemandVisibilityCondition.
  return { id: { in: [] } };
}

/**
 * Add an entry to a candidate's Conversation Log. Any role that adds or updates candidates
 * (CANDIDATE_WRITE_ROLES), on a candidate they can see. Deliberately looser than
 * canEditCandidate: logging a call never changes the record, so a recruiter may log a
 * conversation with a candidate another recruiter sourced.
 */
export function canLogCandidateConversation(
  actor: CandidateActor,
  ctx: { demands: CandidateDemandScope[] }
): boolean {
  if (!actor.role || !CANDIDATE_WRITE_ROLES.includes(actor.role)) return false;
  return canAccessCandidate(actor, ctx);
}
