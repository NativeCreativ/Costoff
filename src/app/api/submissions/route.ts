import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { canEditAsRecordCreator, creatorEditBlockMessage } from '@/lib/auth/creatorScope';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

// GET /api/submissions?demand_id=... or ?request_id=...
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const demandId = searchParams.get('demand_id');
    const requestId = searchParams.get('request_id');

    let targetDemandId = demandId;
    let demand = null as Awaited<ReturnType<typeof loadDemandContext>>;

    // Resolve demand uuid from request_id string if needed
    if (!targetDemandId && requestId) {
      const dem = await prisma.demands.findFirst({
        where: { request_id: requestId },
        select: { id: true },
      });
      if (dem) {
        targetDemandId = dem.id;
      }
    }

    if (!targetDemandId) {
      return NextResponse.json({ submissions: [] });
    }

    // Authorization is re-derived from the Demand, never from the id in the query string, so a
    // caller cannot enumerate another demand's pipeline by guessing/borrowing a demand id.
    demand = await loadDemandContext(targetDemandId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const data = await prisma.submissions.findMany({
      where: { demand_id: targetDemandId },
      include: {
        candidates: true,
        demands: {
          select: { request_id: true, skill_description: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Normalise Decimal fields on nested candidates
    const submissions = data.map(s => ({
      ...s,
      candidates: s.candidates
        ? {
            ...s.candidates,
            current_ctc: s.candidates.current_ctc != null ? Number(s.candidates.current_ctc) : null,
            expected_ctc: s.candidates.expected_ctc != null ? Number(s.candidates.expected_ctc) : null,
          }
        : null,
    }));

    return NextResponse.json({ submissions });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in GET /api/submissions:', err);
    return NextResponse.json({ submissions: [] }, { status: 500 });
  }
}

// POST /api/submissions — Batch assign candidates to a demand
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();
    const { demand_id, candidate_ids, stage } = body;

    if (!demand_id || !candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return NextResponse.json({ error: 'demand_id and candidate_ids array are required' }, { status: 400 });
    }

    // Adding candidates to a Demand's pipeline is a pipeline-management action: Super Admin, the
    // AM who owns the Demand, or a Recruiter allocated to it. The Demand is loaded server-side
    // from demand_id — the client cannot assert its own assignment. SPOC / hr / viewer are
    // refused here, which they previously were not (this route had no auth check at all).
    const demand = await loadDemandContext(demand_id);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json(
        { error: 'You do not have permission to add candidates to this demand\'s pipeline' },
        { status: 403 },
      );
    }

    // Fetch existing submissions for this demand to avoid duplicates
    const existing = await prisma.submissions.findMany({
      where: { demand_id },
      select: { candidate_id: true },
    });
    const existingCandidateIds = new Set(existing.map(e => e.candidate_id));

    const newCandidateIds = candidate_ids.filter((cid: string) => !existingCandidateIds.has(cid));

    if (newCandidateIds.length === 0) {
      return NextResponse.json({
        message: 'All selected candidates are already assigned to this requirement',
        count: 0,
        success: true,
      });
    }

    // createMany for batch insert. `added_by` records the actor, which is what the candidate
    // creator-ownership rule reads later (canEditAsRecordCreator) — derived from the session,
    // never from the request body.
    await prisma.submissions.createMany({
      data: newCandidateIds.map((cid: string) => ({
        demand_id,
        candidate_id: cid,
        stage: stage || 'phone_call_done',
        remarks: 'Assigned to Requirement',
        added_by: currentUser.userId,
        submitted_by_ta: currentUser.role === 'ta' ? currentUser.userId : null,
      })),
    });

    // Re-fetch the newly created rows
    const created = await prisma.submissions.findMany({
      where: {
        demand_id,
        candidate_id: { in: newCandidateIds },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ submissions: created, count: created.length, success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in POST /api/submissions:', err);
    return NextResponse.json({ error: 'Failed to assign candidates' }, { status: 500 });
  }
}

// PUT /api/submissions — Update candidate stage or remarks
export async function PUT(request: Request) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();
    const { id, stage, remarks } = body;

    if (!id) {
      return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 });
    }

    // Changing a candidate's stage is an EDIT of that candidate's relationship with this
    // Demand, so it goes through the same two rules as every other candidate mutation:
    // demand scope (canManageDemandPipeline) then — for a Recruiter — creator ownership
    // (canEditAsRecordCreator). The submission is loaded from the database to resolve both;
    // the id in the body is never trusted for authorization.
    const submission = await prisma.submissions.findUnique({
      where: { id },
      select: { id: true, demand_id: true, added_by: true },
    });
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    if (!submission.demand_id) {
      return NextResponse.json({ error: 'This candidate is not in any requirement\'s pipeline' }, { status: 400 });
    }

    const demand = await loadDemandContext(submission.demand_id);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canManageDemandPipeline(actor, demand, demand.recruiterIds)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this demand\'s pipeline' },
        { status: 403 },
      );
    }
    if (currentUser.role === 'ta') {
      const decision = {
        actorId: currentUser.userId,
        creatorId: submission.added_by ?? null,
        creatorIsRecruiter: (await recruiterProfileIds([submission.added_by])).has(submission.added_by ?? ''),
        currentRecruiterIds: demand.recruiterIds,
      };
      if (!canEditAsRecordCreator(decision)) {
        return NextResponse.json({ error: creatorEditBlockMessage(decision, 'candidate in this pipeline') }, { status: 403 });
      }
    }

    const updatePayload: Record<string, any> = { updated_at: new Date() };
    if (stage !== undefined) updatePayload.stage = stage;
    if (remarks !== undefined) updatePayload.remarks = remarks;

    const updated = await prisma.submissions.update({
      where: { id },
      data: updatePayload,
      include: { candidates: true },
    });

    return NextResponse.json({ submission: updated, success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in PUT /api/submissions:', err);
    return NextResponse.json({ error: 'Failed to update submission stage' }, { status: 500 });
  }
}
