import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canUploadProfilesToDemand } from '@/lib/auth/demandFulfillmentPermissions';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { addDemandCandidateSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { getResumeCapStatus } from '@/lib/demandFulfillment/resumeCap';
import { attachCandidateToDemand, CandidateAlreadyInPipelineError } from '@/lib/demandFulfillment/attachCandidateToDemand';
import { canEditAsRecordCreator, creatorEditBlockMessage } from '@/lib/auth/creatorScope';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { buildRawSkillOverlapWhere } from '@/lib/search';
import { findDuplicateCandidate, duplicateCandidateMessage } from '@/lib/candidates/duplicateCheck';
import { isUniqueViolation } from '@/lib/masters/masterName';


function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function serializeCandidate(c: any) {
  return c ? { ...c, current_ctc: toNum(c.current_ctc), expected_ctc: toNum(c.expected_ctc) } : null;
}

/**
 * Narrows pipeline rows to the candidates whose `skills` overlap a demand's
 * technology_stack. Reuses buildRawSkillOverlapWhere — the single skill-matching
 * implementation already used by GET /api/candidates?requestId= for the "Add Existing
 * Candidate" picker — so the two surfaces can never disagree.
 *
 * `matchSkills=true` has exactly one caller today (the global Interviews & Schedules screen's
 * Candidate field — see InterviewFormModal.tsx), which wants "no required skills" to mean "show
 * every pipeline candidate", unlike the master-pool picker's "match nothing to match against ->
 * show nothing" rule. If a second matchSkills=true caller ever wants that stricter rule instead,
 * this will need a per-caller flag the way GET /api/candidates's allowAllWhenNoSkills is one.
 */
async function filterRowsByDemandSkills<T extends { candidate_id: string | null }>(rows: T[], technologyStack: string[]): Promise<T[]> {
  const skillClause = buildRawSkillOverlapWhere('skills', technologyStack);
  if (skillClause === Prisma.empty) return rows;
  const eligible = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM candidates WHERE ${skillClause}`;
  const eligibleIds = new Set(eligible.map((c) => c.id));
  return rows.filter((r) => !!r.candidate_id && eligibleIds.has(r.candidate_id));
}

// GET /api/demands/[requestId]/candidates?status=&source=&recruiter_id= — pipeline listing with filters.
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const source = searchParams.get('source') || undefined;
    const recruiterId = searchParams.get('recruiter_id') || undefined;
    const positionSlot = searchParams.get('position_slot');
    // Opt-in: restrict the response to candidates whose skills overlap this demand's
    // technology_stack, using the SAME buildRawSkillOverlapWhere matching the "Add Existing
    // Candidate" picker already uses (GET /api/candidates?requestId=) — no second algorithm.
    // Absent/false (the default, i.e. every existing caller including the Pipeline tab) the
    // response is byte-identical to before this param existed.
    const matchSkills = searchParams.get('matchSkills') === 'true';

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }
    const demandId = demand.id;

    const where: any = { demand_id: demandId };
    if (status) where.current_status = status;
    if (source) where.source = source;
    if (recruiterId) where.added_by = recruiterId;
    if (positionSlot) where.position_slot = Number(positionSlot);

    const rows = await prisma.submissions.findMany({
      where,
      include: {
        candidates: true,
        profiles_submissions_added_byToprofiles: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // Opt-in skill narrowing (see the matchSkills param above and filterRowsByDemandSkills's
    // own doc comment for the "no required skills" rule, which differs from the master-DB
    // skill picker's on purpose).
    const visibleRows = matchSkills
      ? await filterRowsByDemandSkills(rows, demand.technology_stack)
      : rows;

    const capStatus = await getResumeCapStatus(demandId, demand.num_positions, demand.company_id);

    // Per-row `can_edit` so the pipeline can DISABLE (not hide) the candidate actions for
    // a row another recruiter added. Same creator rule (canEditAsRecordCreator) that the
    // status/PUT/DELETE routes enforce, so a button is never enabled for an action the
    // API would reject.
    const actor = { role: currentUser.role, id: currentUser.userId };
    const recruiters = await recruiterProfileIds(rows.map((r) => r.added_by));
    const decisionFor = (adder: string | null) => ({
      actorId: actor.id || '',
      creatorId: adder,
      creatorIsRecruiter: recruiters.has(adder ?? ''),
      currentRecruiterIds: demand.recruiterIds,
    });

    return NextResponse.json({
      candidates: visibleRows.map((r) => {
        const decision = decisionFor(r.added_by ?? null);
        const blocked = actor.role === 'ta' && !canEditAsRecordCreator(decision)
          ? creatorEditBlockMessage(decision, 'candidate in this pipeline')
          : null;
        return {
          ...r,
          candidates: serializeCandidate(r.candidates),
          can_edit: blocked == null,
          edit_blocked_reason: blocked,
        };
      }),
      cap: capStatus,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/candidates:', error);
    return NextResponse.json({ candidates: [] }, { status: 500 });
  }
}

// POST /api/demands/[requestId]/candidates — attach a candidate (existing or newly created) to a demand.
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const demandId = demand.id;
    // Upload only: any Recruiter may add a profile (as Sourced) to any demand; everything after
    // that stays with the assigned team (canManageDemandPipeline on the other pipeline routes).
    if (!canUploadProfilesToDemand({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to add candidates to this demand' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = addDemandCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    let { candidate_id, new_candidate_data, source, position_slot, remark } = parsed.data;

    // Reject internal_db explicitly — it is no longer a valid source value.
    if ((source as string) === 'internal_db') {
      return NextResponse.json({ error: 'Source "internal_db" is no longer supported. Use a valid source from the unified list.' }, { status: 400 });
    }

    // If source not provided, fall back to the candidate's own source.
    let finalSource: string | undefined = source;
    if (!finalSource && candidate_id) {
      const candidate = await prisma.candidates.findUnique({ where: { id: candidate_id }, select: { source: true } });
      finalSource = candidate?.source ?? undefined;
    }

    // Active slots are positions × the resume cap (default 5). A further upload is
    // still stored, as Backup, so sourcing can keep accepting profiles.

    let resolvedCandidateId = candidate_id;
    if (!resolvedCandidateId && new_candidate_data) {
      // Dead in today's UI (the real "Add New Candidate" flow goes through POST
      // /api/candidates instead), but this must not become a silent bypass of the one
      // dedup rule every other create path enforces.
      const duplicate = await findDuplicateCandidate(new_candidate_data.email, new_candidate_data.phone);
      if (duplicate) {
        return NextResponse.json(
          {
            error: duplicateCandidateMessage(duplicate),
            isDuplicate: true,
            code: 'DUPLICATE_CANDIDATE',
            field: duplicate.field,
            existingCandidate: { id: duplicate.existingCandidate.id, full_name: duplicate.existingCandidate.full_name },
          },
          { status: 409 }
        );
      }
      const created = await prisma.candidates.create({
        data: {
          full_name: new_candidate_data.full_name,
          email: new_candidate_data.email || null,
          phone: new_candidate_data.phone || null,
          skills: new_candidate_data.skills || [],
          source: finalSource,
          added_by: currentUser.userId,
        },
      });
      resolvedCandidateId = created.id;
    }
    if (!resolvedCandidateId) {
      return NextResponse.json({ error: 'candidate_id or new_candidate_data is required' }, { status: 400 });
    }

    // Info (not a block): surface the candidate's history in other demands.
    const otherDemands = await prisma.submissions.findMany({
      where: { candidate_id: resolvedCandidateId, demand_id: { not: demandId } },
      select: { demand_id: true, current_status: true, is_active: true, demands: { select: { request_id: true, skill_description: true } } },
    });

    let submission;
    try {
      // Same add / reactivate rules as a "Fit" call (attachCandidateToDemand). A previously
      // rejected row on this demand is reactivated; the frontend confirms that with the user first.
      submission = await prisma.$transaction((tx) =>
        attachCandidateToDemand(tx, {
          demandId,
          numPositions: demand.num_positions,
          companyId: demand.company_id,
          candidateId: resolvedCandidateId!,
          source: finalSource,
          positionSlot: position_slot,
          remark,
          actorId: currentUser.userId,
        })
      );
    } catch (txError) {
      if (txError instanceof CandidateAlreadyInPipelineError) {
        return NextResponse.json(
          { error: 'This candidate is already active in this demand\'s pipeline', code: 'CANDIDATE_ALREADY_IN_PIPELINE', stage: txError.stage },
          { status: 409 }
        );
      }
      if (isUniqueViolation(txError)) {
        // Race: another request's add/reactivate committed between our pre-check and insert.
        const winner = await prisma.submissions.findFirst({ where: { demand_id: demandId, candidate_id: resolvedCandidateId, is_active: true } });
        return NextResponse.json(
          { error: 'This candidate is already active in this demand\'s pipeline', code: 'CANDIDATE_ALREADY_IN_PIPELINE', stage: winner?.current_status ?? null },
          { status: 409 }
        );
      }
      throw txError;
    }

    return NextResponse.json({ submission, otherDemands, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/[requestId]/candidates:', error);
    return NextResponse.json({ error: 'Failed to add candidate to demand' }, { status: 500 });
  }
}
