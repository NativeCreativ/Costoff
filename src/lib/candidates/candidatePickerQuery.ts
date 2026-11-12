// The "Add Existing Candidate" picker over the whole candidate master pool (Demand detail >
// Pipeline). Raw SQL on purpose: the skills search needs array_to_string(skills) ILIKE, which
// Prisma's where-builder cannot express, and the keyset pagination needs to share ONE query
// with that search instead of pre-fetching every matching id.

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { buildCandidateVisibilityCondition } from '@/lib/auth/candidatePermissions';
import { rawIdentifier } from '@/lib/auth/rawSqlIdentifier';
import { encodeKeysetCursor, decodeKeysetCursor, type KeysetCursor } from '@/lib/paginationCursor';

/** Page size for the picker. The caller cannot raise it: the pool runs to lakhs of rows. */
export const CANDIDATE_PICKER_PAGE_SIZE = 20;

export interface PickerCandidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  source: string | null;
  current_company: string | null;
  current_designation: string | null;
  current_location: string | null;
  created_at: string | null;
  /** True when the candidate already has an ACTIVE entry in this demand's pipeline. */
  already_in_pipeline: boolean;
}

/** What `$queryRaw` hands back: timestamptz columns arrive as Date, not string. */
type PickerRow = Omit<PickerCandidate, 'created_at' | 'skills' | 'already_in_pipeline'> & {
  created_at: Date | null;
  skills: string[] | null;
  already_in_pipeline: boolean;
};

export interface PickerPage {
  candidates: PickerCandidate[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Only the columns the picker renders (plus source, which prefills the dropdown) and the
// cursor tuple. An identifier, not a bind value — see rawSqlIdentifier.
const ALIAS = rawIdentifier('c');

// Partial, case-insensitive, over name / email / phone / skills. Same fields the candidate
// list has always searched; the GIN trigram indexes (migration 20261019093000_*) are what
// keep `%term%` from degrading into a full scan on a lakh-row pool. The skills arm must call
// the same candidates_skills_text() the index was built on, or the index is never used.
function buildSearchClause(search: string): Prisma.Sql {
  const term = search.trim();
  if (!term) return Prisma.empty;
  const pattern = `%${term}%`;
  return Prisma.sql`(
    c.full_name ILIKE ${pattern}
    OR c.email ILIKE ${pattern}
    OR c.phone ILIKE ${pattern}
    OR candidates_skills_text(c.skills) ILIKE ${pattern}
  )`;
}

// Keyset predicate over the exact sort tuple. `id` is the deterministic tie-break that makes
// the ordering total, so concurrent inserts can never shift or skip a row across pages.
function buildCursorClause(cursor: KeysetCursor | null): Prisma.Sql {
  if (!cursor) return Prisma.empty;
  const at = new Date(cursor.createdAt);
  return Prisma.sql`(
    c.created_at < ${at}
    OR (c.created_at = ${at} AND c.id < ${cursor.id}::uuid)
  )`;
}

export interface FetchCandidatePickerArgs {
  actor: { role?: string | null; id?: string | null };
  search?: string;
  cursor?: string | null;
  demandId: string;
}

/** One keyset page of the picker, newest first. Candidates already in the demand's pipeline are
 *  returned like any other row and flagged by the route — the picker shows them disabled. */
export async function fetchCandidatePickerPage({ actor, search, cursor, demandId }: FetchCandidatePickerArgs): Promise<PickerPage> {
  const keyset = decodeKeysetCursor(cursor);
  const visibility = buildCandidateVisibilityCondition(actor, 'c');
  const searchClause = buildSearchClause(search ?? '');
  const cursorClause = buildCursorClause(keyset);
  // Annotation only, never a filter: a candidate already in this demand's pipeline is shown
// disabled rather than hidden.
const activeInDemand = Prisma.sql`EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.candidate_id = c.id AND s.demand_id = ${demandId}::uuid AND s.is_active = true
  )`;

  const conditions: Prisma.Sql[] = [Prisma.sql`(c.profile_archived IS DISTINCT FROM true)`];
  if (visibility !== Prisma.empty) conditions.push(visibility);
  if (searchClause !== Prisma.empty) conditions.push(searchClause);
  if (cursorClause !== Prisma.empty) conditions.push(cursorClause);

  // One extra row answers hasMore without a second COUNT over the pool.
  const rows = await prisma.$queryRaw<PickerRow[]>`
    SELECT
      c.id,
      c.full_name,
      c.email,
      c.phone,
      c.skills,
      c.source,
      c.current_company,
      c.current_designation,
      c.current_location,
      c.created_at,
      ${activeInDemand} AS already_in_pipeline
    FROM candidates c
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ${CANDIDATE_PICKER_PAGE_SIZE + 1}
  `;

  const hasMore = rows.length > CANDIDATE_PICKER_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CANDIDATE_PICKER_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    candidates: page.map(({ already_in_pipeline, ...candidate }) => ({
      ...candidate,
      skills: candidate.skills ?? [],
      created_at: candidate.created_at ? new Date(candidate.created_at).toISOString() : null,
      already_in_pipeline: Boolean(already_in_pipeline),
    })),
    nextCursor:
      hasMore && last?.created_at
        ? encodeKeysetCursor({ createdAt: new Date(last.created_at).toISOString(), id: last.id })
        : null,
    hasMore,
  };
}