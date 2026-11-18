import { withoutPanCiphertext } from '@/lib/candidates/panCrypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import {
  canAccessCandidate,
  accessibleDemandIdsForCandidate,
  loadCandidateAccessContext,
  canEditCandidate,
} from '@/lib/auth/candidatePermissions';
import { canEditInterview, interviewEditBlockReason } from '@/lib/auth/interviewPermissions';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { serializeInterview } from '@/lib/serializeInterview';

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}


export async function GET(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { candidateId } = await params;
    if (!candidateId) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    // Candidate 360 shows interviews/offers/onboarding, so gate it with the same
    // candidate access rule as the rest of the module — an assignment-scoped role may
    // only open it for a candidate attached to one of their own demands.
    const access = await loadCandidateAccessContext(candidateId);
    if (!access) {
      return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    }
    if (!canAccessCandidate({ role: currentUser.role, id: currentUser.userId }, access)) {
      return NextResponse.json({ error: 'You do not have permission to access this candidate' }, { status: 403 });
    }

    // The candidate itself is reachable if ANY of its demands is, but the demand-specific
    // records below are NOT the same across those demands. A candidate shared by two
    // recruiters would otherwise hand Recruiter 1 Recruiter 2's interview feedback,
    // results, offer CTC and onboarding/BGV status. So restrict every child collection
    // to the demand ids this actor is actually entitled to, and drop the rest entirely.
    const allowedDemandIds = accessibleDemandIdsForCandidate(
      { role: currentUser.role, id: currentUser.userId },
      access
    );

    // 1. Fetch candidate profile
    const candidate = await prisma.candidates.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    }

    // 2. Fetch interviews for this candidate (by candidate_id FK)
    const interviewData = await prisma.interviews.findMany({
      where: { candidate_id: candidateId, demand_id: { in: allowedDemandIds } },
      include: {
        demands: {
          select: {
            request_id: true,
            skill_description: true,
            created_by: true,
            contact_profile_id: true,
            spoc_profile_id: true,
            demand_ta_allocations: { select: { ta_id: true } },
          },
        },
        profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { scheduled_date: 'asc' },
    });

    // Per-interview `can_manage` so the Candidate 360 drawer can DISABLE (not hide) the
    // edit / reschedule / cancel actions for an interview another recruiter scheduled.
    // Uses the same canEditInterview the mutating routes enforce.
    const actor = { role: currentUser.role, id: currentUser.userId };
    const recruiterIds = await recruiterProfileIds(interviewData.map((iv) => iv.created_by));
    const interviews = interviewData.map(iv => {
      const demandRecruiterIds = iv.demands
        ? iv.demands.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id)
        : [];
      const creatorIsRecruiter = recruiterIds.has(iv.created_by ?? '');
      const canManage = !!iv.demands
        && canEditInterview(actor, iv.demands, demandRecruiterIds, iv.created_by, creatorIsRecruiter);
      return {
        ...serializeInterview(iv),
        demand_request_id: iv.demands?.request_id ?? null,
        can_manage: canManage,
        manage_blocked_reason: canManage
          ? null
          : interviewEditBlockReason(actor, demandRecruiterIds, iv.created_by, creatorIsRecruiter),
      };
    });

    // 3. Fetch offers for this candidate (scoped to accessible demands, as above)
    const offersData = await prisma.offers.findMany({
      where: { candidate_id: candidateId, demand_id: { in: allowedDemandIds } },
      include: {
        demands: { select: { request_id: true, skill_description: true } },
      },
    });

    const offers = offersData.map(o => ({
      ...o,
      offered_ctc: toNum(o.offered_ctc),
    }));

    // 4. Fetch onboardings for this candidate (scoped to accessible demands, as above)
    const onboardingsData = await prisma.onboardings.findMany({
      where: { candidate_id: candidateId, demand_id: { in: allowedDemandIds } },
      include: {
        demands: { select: { request_id: true, skill_description: true } },
      },
    });

    // 5. Gather all linked Request IDs. The pipeline (submissions) is the source of truth for
    // "which demands is this candidate in"; interviews / offers / onboardings only exist from
    // later stages, so reading them alone showed a Sourced or Shortlisted candidate as
    // "Unmapped / General Candidate Pool". Still limited to demands this viewer may see.
    const pipelineDemands = allowedDemandIds.length
      ? await prisma.demands.findMany({
          where: { id: { in: allowedDemandIds }, submissions: { some: { candidate_id: candidateId } } },
          select: { request_id: true },
          orderBy: { created_at: 'desc' },
        })
      : [];
    const linkedReqIds = new Set<string>(pipelineDemands.map((d) => d.request_id));
    interviews.forEach(i => { if (i.demand_request_id) linkedReqIds.add(i.demand_request_id); });
    offers.forEach(o => { if (o.demands?.request_id) linkedReqIds.add(o.demands.request_id); });
    onboardingsData.forEach(ob => { if (ob.demands?.request_id) linkedReqIds.add(ob.demands.request_id); });

    return NextResponse.json({
      success: true,
      // Same rule the PUT /api/candidates route enforces, so forms can show or skip editing.
      can_edit: canEditCandidate({ role: currentUser.role, id: currentUser.userId }, access),
      candidate: {
        ...withoutPanCiphertext(candidate),
        current_ctc: toNum(candidate.current_ctc),
        expected_ctc: toNum(candidate.expected_ctc),
        offer_ctc: toNum(candidate.offer_ctc),
      },
      linkedRequestIds: Array.from(linkedReqIds),
      interviews,
      offers,
      onboardings: onboardingsData,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in /api/candidates/[candidateId]/history:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
