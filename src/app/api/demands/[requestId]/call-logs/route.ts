import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canLogDemandCall } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { attachCandidateToDemand, CandidateAlreadyInPipelineError } from '@/lib/demandFulfillment/attachCandidateToDemand';
import { findDuplicateCandidate } from '@/lib/candidates/duplicateCheck';
import { isUniqueViolation } from '@/lib/masters/masterName';
import { callLogSchema } from '@/components/demandFulfillment/callLog.schema';
import { normalizeEmail } from '@/lib/candidateNormalize';

const CALL_LOG_LIMIT = 300;

/**
 * GET /api/demands/[requestId]/call-logs — the demand's Call Log, newest first, plus per-caller
 * totals (calls / fit / not fit) — the "how many calls each TA made" metric. Readable by anyone
 * who can view the demand; `can_log` tells the UI whether to show "Log a Call".
 */
export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canViewDemand(actor, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const [rows, perCaller] = await Promise.all([
      prisma.demand_call_logs.findMany({
        where: { demand_id: demand.id },
        orderBy: { created_at: 'desc' },
        take: CALL_LOG_LIMIT,
        include: {
          profiles: { select: { full_name: true } },
          candidates: { select: { full_name: true, phone: true, email: true, current_company: true, total_experience: true } },
        },
      }),
      prisma.demand_call_logs.groupBy({
        by: ['created_by', 'outcome'],
        where: { demand_id: demand.id },
        _count: { _all: true },
      }),
    ]);

    const callerIds = [...new Set(perCaller.map((r) => r.created_by).filter((id): id is string => !!id))];
    const callers = callerIds.length
      ? await prisma.profiles.findMany({ where: { id: { in: callerIds } }, select: { id: true, full_name: true, role: true } })
      : [];
    const summary = callers
      .map((p) => {
        const mine = perCaller.filter((r) => r.created_by === p.id);
        const fit = mine.find((r) => r.outcome === 'fit')?._count._all ?? 0;
        const notFit = mine.find((r) => r.outcome === 'not_fit')?._count._all ?? 0;
        return { user_id: p.id, name: p.full_name, role: p.role, calls: fit + notFit, fit, not_fit: notFit };
      })
      .sort((a, b) => b.calls - a.calls);

    return NextResponse.json({
      calls: rows.map((r) => ({
        id: r.id,
        outcome: r.outcome,
        fail_reason: r.fail_reason,
        notes: r.notes,
        created_at: r.created_at.toISOString(),
        caller_name: r.profiles?.full_name ?? null,
        candidate_id: r.candidate_id,
        candidate: r.candidates,
        moved_to_sourcing: !!r.submission_id,
      })),
      summary,
      can_log: canLogDemandCall(actor, demand, demand.recruiterIds),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/call-logs:', error);
    return NextResponse.json({ error: 'Failed to load the call log' }, { status: 500 });
  }
}

/**
 * POST /api/demands/[requestId]/call-logs — log one call.
 *
 * The candidate is an existing one (`candidate_id`) or new (`new_candidate`). A new candidate who
 * matches an existing profile by email or phone is NOT duplicated: the call is logged against
 * that profile. Either way the profile is in the candidate database.
 *   fit     → the candidate goes into this demand's pipeline as Sourced (same rules as Add
 *             Candidate). Already active here → the call is still logged, nothing else changes.
 *   not_fit → only the call and its fail reason are stored.
 */
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    if (!canLogDemandCall({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to log calls for this demand' }, { status: 403 });
    }

    const parsed = callLogSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;

    // Resolve the candidate before the transaction (the duplicate check reads outside it).
    let candidateId = v.candidate_id ?? null;
    let reusedExisting = false;
    let source: string | undefined;
    if (candidateId) {
      const existing = await prisma.candidates.findUnique({ where: { id: candidateId }, select: { id: true, source: true } });
      if (!existing) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      source = existing.source ?? undefined;
    } else if (v.new_candidate) {
      const nc = v.new_candidate;
      const duplicate = await findDuplicateCandidate(nc.email || null, nc.phone);
      if (duplicate) {
        candidateId = duplicate.existingCandidate.id;
        reusedExisting = true;
      } else {
        const created = await prisma.candidates.create({
          data: {
            full_name: nc.full_name,
            phone: nc.phone,
            email: nc.email ? normalizeEmail(nc.email) : null,
            current_company: nc.current_company || null,
            current_location: nc.current_location || null,
            total_experience: nc.total_experience || null,
            availability: nc.availability,
            expected_ctc: nc.expected_ctc ? Number(nc.expected_ctc) : null,
            source: nc.source,
            added_by: currentUser.userId,
            updated_by: currentUser.userId,
          },
          select: { id: true },
        });
        candidateId = created.id;
      }
      source = nc.source;
    }
    if (!candidateId) return NextResponse.json({ error: 'Pick an existing candidate or enter a new one' }, { status: 400 });

    let alreadyInPipeline = false;
    const result = await prisma.$transaction(async (tx) => {
      let submissionId: string | null = null;
      if (v.outcome === 'fit') {
        try {
          const submission = await attachCandidateToDemand(tx, {
            demandId: demand.id,
            numPositions: demand.num_positions,
            candidateId: candidateId!,
            source,
            remark: 'Added from a call (fit)',
            actorId: currentUser.userId,
          });
          submissionId = submission.id;
        } catch (error) {
          if (!(error instanceof CandidateAlreadyInPipelineError)) throw error;
          alreadyInPipeline = true;
        }
      }
      return tx.demand_call_logs.create({
        data: {
          demand_id: demand.id,
          candidate_id: candidateId!,
          outcome: v.outcome,
          fail_reason: v.outcome === 'not_fit' ? v.fail_reason ?? null : null,
          notes: v.notes || null,
          submission_id: submissionId,
          created_by: currentUser.userId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      call: { id: result.id, outcome: result.outcome },
      candidate_id: candidateId,
      reused_existing_candidate: reusedExisting,
      moved_to_sourcing: !!result.submission_id,
      already_in_pipeline: alreadyInPipeline,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isUniqueViolation(error)) {
      // A concurrent save won the race (the same candidate created, or added to this pipeline).
      return NextResponse.json({ error: 'Someone else just saved this candidate. Refresh and log the call again.' }, { status: 409 });
    }
    console.error('Error in POST /api/demands/[requestId]/call-logs:', error);
    return NextResponse.json({ error: 'Failed to log the call' }, { status: 500 });
  }
}
