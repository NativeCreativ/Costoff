import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import {
  CANDIDATE_WRITE_ROLES,
  MASTER_POOL_CREATE_ROLES,
  buildCandidateScopeFilter,
  canAccessCandidate,
  canEditCandidate,
  candidateEditBlockReason,
  loadCandidateAccessContext,
  loadCandidateAccessContexts,
} from '@/lib/auth/candidatePermissions';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canUploadProfilesToDemand } from '@/lib/auth/demandFulfillmentPermissions';
import { CANDIDATE_CHANGE_FIELD_LABELS, candidateChangeSnapshot, diffFields, pickSent, recordDemandChanges } from '@/lib/demands/demandChangeLog';
import { findCandidateArchiveBlocker } from '@/lib/lifecycle/archive';
import { candidateApiSchema } from '@/components/candidates/candidate.schema';
import { normalizeEmail } from '@/lib/candidateNormalize';
import { findDuplicateCandidate, duplicateCandidateMessage, type DuplicateCandidateMatch } from '@/lib/candidates/duplicateCheck';
import { buildSearchWhere, buildRawIlikeWhere, buildRawSkillOverlapWhere } from '@/lib/search';
import { buildExactMatchWhere } from '@/lib/filter';
import { CANDIDATE_SEARCH_FIELDS, CANDIDATE_SEARCH_ARRAY_FIELDS } from '@/constants/search';
import { CANDIDATE_FILTER_FIELDS } from '@/constants/filters';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { SUBMISSION_SOURCE_VALUES } from '@/lib/demandFulfillment/constants';
import { normalizeSkillsInput } from '@/lib/skills';
import { isAllowedListId } from '@/lib/settingsListValidation';
import { fetchCandidatePickerPage } from '@/lib/candidates/candidatePickerQuery';

const FORBIDDEN_CANDIDATE = 'You do not have permission to access this candidate';

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function serializeCandidate<T extends {
  current_ctc?: unknown;
  expected_ctc?: unknown;
  offer_ctc?: unknown;
  profiles_candidates_added_byToprofiles?: { full_name: string; email: string } | null;
}>(candidate: T) {
  const { profiles_candidates_added_byToprofiles, ...rest } = candidate;
  return {
    ...rest,
    current_ctc: toNumberOrNull(candidate.current_ctc),
    expected_ctc: toNumberOrNull(candidate.expected_ctc),
    offer_ctc: toNumberOrNull(candidate.offer_ctc),
    added_by_name: profiles_candidates_added_byToprofiles?.full_name ?? null,
    added_by_email: profiles_candidates_added_byToprofiles?.email ?? null,
  };
}

function duplicateResponse(match: DuplicateCandidateMatch) {
  return NextResponse.json({
    error: duplicateCandidateMessage(match),
    isDuplicate: true,
    code: 'DUPLICATE_CANDIDATE',
    duplicateField: match.field,
    field: match.field,
    existingCandidate: { id: match.existingCandidate.id, full_name: match.existingCandidate.full_name, email: match.existingCandidate.email },
    ...(match.secondCandidate
      ? { secondCandidate: { id: match.secondCandidate.id, full_name: match.secondCandidate.full_name, email: match.secondCandidate.email } }
      : {}),
  }, { status: 409 });
}

/** Per-candidate pipeline annotations for one page of the demand picker: the last INACTIVE
 *  (rejected/dropped/backed-out) submission for this demand, so the UI can offer a re-add.
 *  Candidates with an ACTIVE entry carry `already_in_pipeline` from the main query instead. */
async function loadPipelineStates(demandId: string, candidateIds: string[]) {
  const map = new Map<string, { entryState: 'inactive'; previousStatus: string }>();
  if (candidateIds.length === 0) return map;
  const rows = await prisma.submissions.findMany({
    where: { demand_id: demandId, candidate_id: { in: candidateIds }, is_active: false },
    select: { candidate_id: true, current_status: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  for (const row of rows) {
    if (row.candidate_id && !map.has(row.candidate_id)) {
      map.set(row.candidate_id, { entryState: 'inactive', previousStatus: row.current_status });
    }
  }
  return map;
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const workMode = searchParams.get('workMode') || '';
    // Optional: scopes results to candidates eligible for this Demand (their skills overlap
    // the demand's technology_stack) — used by the "Add Existing Candidate" picker. Additive:
    // when absent, behavior is identical to before this param existed (main Candidates page).
    const requestId = searchParams.get('requestId') || '';
    const { page, pageSize, skip, take } = parsePagination(
      searchParams.get(PAGE_PARAM),
      searchParams.get(PAGE_SIZE_PARAM)
    );

    const where: Prisma.candidatesWhereInput = {
      ...buildExactMatchWhere<Prisma.candidatesWhereInput>({
        [CANDIDATE_FILTER_FIELDS.source]: source,
        [CANDIDATE_FILTER_FIELDS.workMode]: workMode,
      }),
    };

    // Authorization: a scoped role only ever sees candidates attached to a demand they
    // can reach — `ta` by demand_ta_allocations, `spoc` by spoc_profile_id,
    // `account_manager` by demand ownership (created_by / contact_profile_id).
    // super_admin/hr/viewer are unrestricted. Applied BEFORE search/pagination so
    // totals and pages cannot leak the existence of candidates outside the actor's scope.
    const scopeFilter = await buildCandidateScopeFilter({
      role: currentUser.role,
      id: currentUser.userId,
    });
    if (scopeFilter) {
      // AND-ed, never merged with Object.assign: the scope and the search can both use an `OR`
      // key, and merging let one replace the other — an AM's search then skipped their scope.
      const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...existingAnd, scopeFilter];
    }

    // Archived candidates (soft-deleted) are hidden from every list and from the
    // demand "Add Existing Candidate" picker, so they can't be silently re-added to a
    // pipeline. Roles that can see everything may opt in explicitly for reporting.
    const includeArchived = searchParams.get('includeArchived') === 'true';
    if (!includeArchived) {
      where.profile_archived = { not: true };
    }

    // Set when requestId is present, so the result page can be annotated with each
    // candidate's pipeline state for THIS demand after the main query runs (see below).
    let pipelineDemandId: string | null = null;

    // The "Add Existing Candidate" picker (Demand detail > Pipeline) opts into the whole
    // candidate pool with cursor pagination and no skill filter. A separate flag, because the
    // Interviews & Schedules candidate field calls this same endpoint WITH requestId and
    // depends on its skill filter + already-pipelined exclusion staying exactly as they are.
    const picker = searchParams.get('picker') === 'all';

    if (requestId) {
      const demand = await loadDemandContext(requestId);
      if (!demand) {
        return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
      }
      // The demand-scoped picker is an on-demand lookup: refuse it up front rather than
      // letting an unauthorised caller probe another demand's eligible candidate pool.
      if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
        return NextResponse.json({ error: FORBIDDEN_CANDIDATE }, { status: 403 });
      }
      pipelineDemandId = demand.id;

      if (picker) {
        // Everything this endpoint does for the picker happens in one keyset query, then the
        // page is annotated with each candidate's state in THIS demand.
        const page = await fetchCandidatePickerPage({
          actor: { role: currentUser.role, id: currentUser.userId },
          search,
          cursor: searchParams.get('cursor'),
          demandId: demand.id,
        });
        const pipelineStates = await loadPipelineStates(demand.id, page.candidates.map((c) => c.id));
        return NextResponse.json({
          candidates: page.candidates.map((c) => ({ ...c, ...pipelineStates.get(c.id) })),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
      }

      // A demand with no configured required skills has nothing to match against. The default
      // (and the "Add Existing Candidate" picker's only ever behavior) is to explicitly return
      // none rather than silently fall back to showing every candidate. `allowAllWhenNoSkills`
      // is an opt-in for callers that want the opposite in exactly that one case — currently
      // only the global Interviews & Schedules screen's Candidate field — everyone else is
      // byte-identical to before this flag existed.
      const allowAllWhenNoSkills = searchParams.get('allowAllWhenNoSkills') === 'true';
      const skillClause = buildRawSkillOverlapWhere('skills', demand.technology_stack);
      // A candidate with an ACTIVE entry in this demand's pipeline is fully excluded here —
      // never shown, never addable twice — via one NOT EXISTS, not a per-row check. A
      // candidate with only an INACTIVE (rejected/dropped/backed-out) entry stays eligible
      // and is annotated with entryState below, so it can be re-added with a confirmation.
      const notAlreadyPipelined = Prisma.sql`NOT EXISTS (
        SELECT 1 FROM submissions s
        WHERE s.candidate_id = c.id AND s.demand_id = ${demand.id}::uuid AND s.is_active = true
      )`;
      const eligibleIds =
        skillClause !== Prisma.empty
          ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM candidates c WHERE ${skillClause} AND ${notAlreadyPipelined}`
          : allowAllWhenNoSkills
          ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM candidates c WHERE ${notAlreadyPipelined}`
          : [];
      // Hard AND with the rest of the where clause: the free-text search below can only
      // narrow further within this eligible set, never widen beyond it.
      where.id = { in: eligibleIds.map((c) => c.id) };
    }

    if (search) {
      const textOr = buildSearchWhere<Prisma.candidatesWhereInput>(search, CANDIDATE_SEARCH_FIELDS) ?? [];
      // skills is a String[] column; Prisma's query builder only supports exact-element array
      // matching (has/hasSome), not case-insensitive substring search, so match it via raw SQL
      // (same buildRawIlikeWhere helper the Demand module uses for its array fields).
      const skillsClause = buildRawIlikeWhere(search, [], CANDIDATE_SEARCH_ARRAY_FIELDS);
      const skillMatches = skillsClause !== Prisma.empty
        ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM candidates WHERE ${skillsClause}`
        : [];
      where.OR = [
        ...textOr,
        ...(skillMatches.length > 0 ? [{ id: { in: skillMatches.map((c) => c.id) } }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      prisma.candidates.findMany({
        where,
        include: {
          profiles_candidates_added_byToprofiles: { select: { full_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.candidates.count({ where }),
    ]);

    const serialized = data.map(serializeCandidate);

    // One batched lookup (not per-row) of this demand's INACTIVE entries among just the
    // returned page, so a previously rejected/dropped/backed-out candidate can carry a
    // "Previously <status>" badge instead of either being hidden or looking like a fresh add.
    let inactiveByCandidateId = new Map<string, string>();
    if (pipelineDemandId) {
      const inactiveRows = await prisma.submissions.findMany({
        where: { demand_id: pipelineDemandId, candidate_id: { in: serialized.map((c) => c.id) }, is_active: false },
        select: { candidate_id: true, current_status: true, created_at: true },
        orderBy: { created_at: 'desc' },
      });
      for (const row of inactiveRows) {
        if (row.candidate_id && !inactiveByCandidateId.has(row.candidate_id)) {
          inactiveByCandidateId.set(row.candidate_id, row.current_status);
        }
      }
    }

    // Per-row `can_edit` so the list can DISABLE (not silently hide) Edit / Archive for a
    // candidate another recruiter added to a shared demand. Computed in one batched query
    // and with the same canEditCandidate the PUT/DELETE routes enforce, so a button can
    // never be enabled for an action the API would reject.
    const accessMap = await loadCandidateAccessContexts(serialized.map((c) => c.id));
    const actor = { role: currentUser.role, id: currentUser.userId };
    const withFlags = serialized.map((c) => {
      const ctx = accessMap.get(c.id);
      const previousStatus = pipelineDemandId ? inactiveByCandidateId.get(c.id) ?? null : null;
      return {
        ...c,
        can_edit: ctx ? canEditCandidate(actor, ctx) : false,
        edit_blocked_reason: ctx && !canEditCandidate(actor, ctx)
          ? candidateEditBlockReason(actor, ctx)
          : null,
        ...(pipelineDemandId
          ? { entryState: previousStatus ? ('inactive' as const) : ('none' as const), previousStatus }
          : {}),
      };
    });

    return NextResponse.json({
      candidates: withFlags,
      ...buildPaginationMeta(total, page, pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/candidates:', error);
    return NextResponse.json({ candidates: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(CANDIDATE_WRITE_ROLES);
    const body = await request.json();

    const parsed = candidateApiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    // A demand is optional. Without one the candidate goes into the database only (master pool),
    // which Super Admin, Recruiters and Account Managers may all do (MASTER_POOL_CREATE_ROLES —
    // client decision, Nov 2026); the creator keeps read/edit through candidates.added_by.
    // With a requestId the candidate is also linked to that demand in the same request.
    //
    // The demand is loaded server-side from the requestId; the client cannot assert its
    // own assignment, and the check re-derives it from demand_ta_allocations.
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    let linkedDemand: Awaited<ReturnType<typeof loadDemandContext>> = null;
    if (!requestId && !MASTER_POOL_CREATE_ROLES.includes(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to add candidates without a demand' }, { status: 403 });
    }
    if (requestId) {
      linkedDemand = await loadDemandContext(requestId);
      if (!linkedDemand) {
        return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
      }
      // Viewing a demand is not enough to attach a candidate to it. canUploadProfilesToDemand
      // scopes `am` by ownership, lets any Recruiter upload (assigned or not — the pipeline
      // itself stays with the assigned team), and is true unconditionally for super_admin.
      if (!canUploadProfilesToDemand({ role: currentUser.role, id: currentUser.userId }, linkedDemand, linkedDemand.recruiterIds)) {
        return NextResponse.json({
          error: 'You do not own this demand, so you cannot add a candidate to it.',
        }, { status: 403 });
      }
    }

    const email = normalizeEmail(values.email);
    const phone = values.phone.trim();

    const duplicate = await findDuplicateCandidate(email, phone);
    if (duplicate) {
      return duplicateResponse(duplicate);
    }

    // Rule: the role category must be an ACTIVE skill_categories row; blank means "none".
    const activeSkillCategoryIds = (await prisma.skill_categories.findMany({
      where: { is_active: true },
      select: { id: true },
    })).map((c) => c.id);
    if (!isAllowedListId(values.skills_category_id ?? null, undefined, activeSkillCategoryIds)) {
      return NextResponse.json({ error: 'Selected role category was not found or is inactive' }, { status: 400 });
    }

    const newCandidate = {
      full_name: values.full_name.trim(),
      email,
      phone,
      alternate_phone: values.alternate_phone?.trim() || null,
      current_location: values.current_location?.trim() || null,
      preferred_locations: values.preferred_locations ?? [],
      current_company: values.current_company?.trim() || null,
      current_designation: values.current_designation?.trim() || null,
      total_experience: values.total_experience?.trim() || null,
      skills: normalizeSkillsInput(values.skills),
      skills_category_id: values.skills_category_id ?? null,
      qualification: values.qualification?.trim() || null,
      specialization: values.specialization?.trim() || null,
      current_ctc: values.current_ctc ?? null,
      expected_ctc: values.expected_ctc ?? null,
      available_from: values.available_from ? new Date(values.available_from) : null,
      availability: values.availability || 'Immediate',
      work_mode: values.work_mode || null,
      linked_url: values.linked_url || null,
      source: values.source,
      offer_in_hand: !!values.offer_in_hand,
      offer_company: values.offer_in_hand ? values.offer_company?.trim() || null : null,
      offer_ctc: values.offer_in_hand ? values.offer_ctc ?? null : null,
      offer_doj: values.offer_in_hand && values.offer_doj ? new Date(values.offer_doj) : null,
      added_by: currentUser.userId,
      updated_by: currentUser.userId,
    };

    let data;
    let submissionId: string | null = null;
    try {
      if (linkedDemand) {
        // Create the candidate and its first submission together, so the recruiter has
        // access immediately and the pipeline shows them without a second call.
        // The submission id is returned so the caller can focus the new pipeline card
        // instead of issuing a second attach request (which would duplicate the link).
        const demandId = linkedDemand.id;
        const created = await prisma.$transaction(async (tx) => {
          const candidate = await tx.candidates.create({ data: newCandidate });
          const { nextSourcingType } = await import('@/lib/demandFulfillment/sourcingSlots');
          const sourcingType = await nextSourcingType(tx, demandId, linkedDemand.num_positions);
          const submission = await tx.submissions.create({
            data: {
              demand_id: demandId,
              candidate_id: candidate.id,
              // The pipeline entry mirrors the candidate's own source. 'internal_db' is no longer
              // a valid value (submissions_source_check rejects it), which made every
              // "Add New Candidate" from a demand fail.
              source: values.source,
              sourcing_type: sourcingType,
              added_by: currentUser.userId,
              submitted_by_ta: currentUser.role === 'ta' ? currentUser.userId : null,
              remarks: 'Candidate created from the demand Pipeline',
            },
          });
          return { candidate, submission };
        });
        data = created.candidate;
        submissionId = created.submission.id;
      } else {
        data = await prisma.candidates.create({ data: newCandidate });
      }
    } catch (dbError) {
      console.error('Error creating candidate:', dbError);
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        return NextResponse.json({ error: 'A candidate with this email or phone number already exists.', isDuplicate: true }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create candidate' }, { status: 400 });
    }

    return NextResponse.json({
      candidate: serializeCandidate(data),
      linkedDemandId: linkedDemand?.id ?? null,
      submissionId,
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/candidates:', error);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requireRole(CANDIDATE_WRITE_ROLES);
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    // Authorization is re-derived from the database, never from the id in the body.
    // EDIT is stricter than VIEW: the actor must be able to reach the candidate through
    // one of their own demands (canEditCandidateDemand) AND — for a recruiter — be the
    // one who brought it into that demand's pipeline. Checked before any field is written.
    const access = await loadCandidateAccessContext(id);
    if (!access) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canEditCandidate(actor, access)) {
      return NextResponse.json(
        { error: candidateEditBlockReason(actor, access) ?? FORBIDDEN_CANDIDATE },
        { status: 403 }
      );
    }

    const parsed = candidateApiSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    if (values.email !== undefined || values.phone !== undefined) {
      const existingCandidate = await prisma.candidates.findUnique({ where: { id }, select: { email: true, phone: true } });
      if (!existingCandidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      }
      const email = values.email !== undefined ? normalizeEmail(values.email) : (existingCandidate.email ?? '');
      const phone = values.phone !== undefined ? values.phone.trim() : (existingCandidate.phone ?? '');

      const duplicate = await findDuplicateCandidate(email, phone, id);
      if (duplicate) {
        return duplicateResponse(duplicate);
      }
    }

    const updateData: Prisma.candidatesUncheckedUpdateInput = {};

    if (values.full_name !== undefined) updateData.full_name = values.full_name.trim();
    if (values.email !== undefined) updateData.email = normalizeEmail(values.email);
    if (values.phone !== undefined) updateData.phone = values.phone.trim();
    if (values.alternate_phone !== undefined) updateData.alternate_phone = values.alternate_phone?.trim() || null;
    if (values.current_location !== undefined) updateData.current_location = values.current_location?.trim() || null;
    if (values.preferred_locations !== undefined) updateData.preferred_locations = values.preferred_locations;
    if (values.current_company !== undefined) updateData.current_company = values.current_company?.trim() || null;
    if (values.current_designation !== undefined) updateData.current_designation = values.current_designation?.trim() || null;
    if (values.total_experience !== undefined) updateData.total_experience = values.total_experience?.trim() || null;
    if (values.skills !== undefined) updateData.skills = normalizeSkillsInput(values.skills);

    // Rule: the saved category is grandfathered, so a deactivated one never blocks an edit.
    if (values.skills_category_id !== undefined && values.skills_category_id !== null) {
      const activeSkillCategoryIds = (await prisma.skill_categories.findMany({
        where: { is_active: true },
        select: { id: true },
      })).map((c) => c.id);
      const savedCategory = await prisma.candidates.findUnique({ where: { id }, select: { skills_category_id: true } });
      if (!isAllowedListId(values.skills_category_id, savedCategory?.skills_category_id, activeSkillCategoryIds)) {
        return NextResponse.json({ error: 'Selected role category was not found or is inactive' }, { status: 400 });
      }
    }
    if (values.skills_category_id !== undefined) updateData.skills_category_id = values.skills_category_id;
    if (values.qualification !== undefined) updateData.qualification = values.qualification?.trim() || null;
    if (values.specialization !== undefined) updateData.specialization = values.specialization?.trim() || null;
    if (values.current_ctc !== undefined) updateData.current_ctc = values.current_ctc ?? null;
    if (values.expected_ctc !== undefined) updateData.expected_ctc = values.expected_ctc ?? null;
    if (values.available_from !== undefined) updateData.available_from = values.available_from ? new Date(values.available_from) : null;
    if (values.availability !== undefined) updateData.availability = values.availability;
    if (values.work_mode !== undefined) updateData.work_mode = values.work_mode || null;
    if (values.linked_url !== undefined) updateData.linked_url = values.linked_url || null;
    if (values.source !== undefined) updateData.source = values.source;
    if (values.offer_in_hand !== undefined) {
      // Turning the offer off clears its details, so a stale DOJ never keeps the badge alive.
      updateData.offer_in_hand = values.offer_in_hand;
      updateData.offer_company = values.offer_in_hand ? values.offer_company?.trim() || null : null;
      updateData.offer_ctc = values.offer_in_hand ? values.offer_ctc ?? null : null;
      updateData.offer_doj = values.offer_in_hand && values.offer_doj ? new Date(values.offer_doj) : null;
    }
    updateData.updated_by = currentUser.userId;

    let data;
    try {
      data = await prisma.$transaction(async (tx) => {
        const before = await tx.candidates.findUnique({ where: { id } });
        const updated = await tx.candidates.update({ where: { id }, data: updateData });
        // Change log: a candidate edit is logged on every demand the candidate is in, so each
        // demand's Change Log shows its candidates' detail changes across all phases.
        if (before) {
          const sentFields = Object.keys(updateData).filter((field) => field in CANDIDATE_CHANGE_FIELD_LABELS);
          const changes = diffFields(candidateChangeSnapshot(before), pickSent(candidateChangeSnapshot(updated), sentFields));
          for (const demandId of new Set(access.demands.map((d) => d.demand_id))) {
            await recordDemandChanges(tx, {
              demandId,
              scope: 'candidate',
              changes,
              actorId: currentUser.userId,
              entityId: id,
              entityLabel: updated.full_name,
            });
          }
        }
        return updated;
      });
    } catch (dbError) {
      console.error('Error updating candidate:', dbError);
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        return NextResponse.json({ error: 'A candidate with this email or phone number already exists.', isDuplicate: true }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update candidate' }, { status: 400 });
    }

    return NextResponse.json({ candidate: serializeCandidate(data), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/candidates:', error);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await requireRole(CANDIDATE_WRITE_ROLES);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    // Same creator-ownership rule as PUT, re-derived server-side: the actor must be
    // able to reach the candidate through one of their own demands and, for a
    // recruiter, be the one who added it to that demand's pipeline.
    const access = await loadCandidateAccessContext(id);
    if (!access) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canEditCandidate(actor, access)) {
      return NextResponse.json(
        { error: candidateEditBlockReason(actor, access) ?? FORBIDDEN_CANDIDATE },
        { status: 403 }
      );
    }

    // Hard delete — cascades away submissions, interviews, offers, onboardings and
    // submission_events (ON DELETE CASCADE). Only allowed once the candidate is no
    // longer in a live workflow: remove someone from under an active requisition only
    // by closing/cancelling that workflow first.
    const blocker = await findCandidateArchiveBlocker(id);
    if (blocker) {
      return NextResponse.json({ error: blocker.message, blocked: true }, { status: 409 });
    }

    await prisma.candidates.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: true, candidateId: id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/candidates:', error);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
}
