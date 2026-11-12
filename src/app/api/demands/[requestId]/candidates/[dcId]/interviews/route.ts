import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageInterview } from '@/lib/auth/interviewPermissions';
import { canUpdateSelectionStatus } from '@/lib/auth/demandFulfillmentPermissions';
import { scheduleInterviewSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { isDemandRecruitmentActive } from '@/lib/demandFulfillment/constants';
import { resolveInterviewRounds, resolveInterviewModes } from '@/lib/demandFulfillment/interviewConfig';
import { serializeInterview } from '@/lib/serializeInterview';
import { demandStatusLabel } from '@/lib/demands/demandStatusLabel';

// POST /api/demands/[requestId]/candidates/[dcId]/interviews — schedule an interview round for
// a candidate. Requires at least one round to be configured (demand override, global
// default, or the hardcoded ['Technical', 'HR'] fallback — so this rarely blocks).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string; dcId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { requestId, dcId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const demandId = demand.id;
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canManageInterview(actor, demand, demand.recruiterIds) && !canUpdateSelectionStatus(actor, demand)) {
      return NextResponse.json({ error: 'You do not have permission to schedule interviews for this requirement' }, { status: 403 });
    }

    // Demand status (NOT company status) gates interview scheduling. A demand that has reached a
    // terminal state — Closure / Cancelled — is no longer an active requisition, so a new round
    // cannot be scheduled against it. Enforced here so a direct API call cannot bypass the
    // Request ID dropdown's filtering.
    //
    // Note what is deliberately NOT checked: the company's own status. A company going INACTIVE
    // must not stop recruitment on the demands already running against it.
    if (!isDemandRecruitmentActive(demand.status)) {
      return NextResponse.json(
        { error: `Interviews cannot be scheduled because "${requestId}" is ${demandStatusLabel(demand.status)}. Reopen the requirement first.` },
        { status: 400 }
      );
    }

    const submission = await prisma.submissions.findFirst({ where: { id: dcId, demand_id: demandId } });
    if (!submission) {
      return NextResponse.json({ error: 'Candidate not found in this demand' }, { status: 404 });
    }

    let rounds = await resolveInterviewRounds(demandId);
    if (rounds.length === 0) {
      await prisma.demand_interview_rounds.create({
        data: { demand_id: demandId, name: 'General', round_order: 1, mandatory: false },
      });
      rounds = await resolveInterviewRounds(demandId);
    }

    const body = await request.json();
    const parsed = scheduleInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { round_id, scheduled_date, scheduled_time, end_time, duration_minutes, mode, meeting_link, remark, interview_type, interview_location } = parsed.data;

    // A missing round_id means "use the demand's first round", which is the General
    // round just created when the demand had none.
    const matchedRound = round_id ? rounds.find((r) => r.id === round_id) : rounds[0];
    if (!matchedRound) {
      return NextResponse.json(
        { error: 'The selected Interview Round is not configured for this demand', availableRounds: rounds.map((r) => ({ id: r.id, name: r.name })) },
        { status: 400 }
      );
    }

    const selectionModes = ['InPerson', 'Video'];
    const modeOptions = await resolveInterviewModes();
    const resolvedMode = mode || modeOptions[0] || 'Video';
    if (!selectionModes.includes(resolvedMode) && !modeOptions.includes(resolvedMode)) {
      return NextResponse.json(
        { error: `"${resolvedMode}" is not a configured interview mode`, availableModes: modeOptions },
        { status: 400 }
      );
    }

    const interview = await prisma.$transaction(async (tx) => {
      const created = await tx.interviews.create({
        include: {
          profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
        },
        data: {
          submission_id: dcId,
          demand_id: demandId,
          candidate_id: submission.candidate_id,
          round_id: matchedRound.id,
          level: matchedRound.name, // denormalized display copy, derived from round_id
          round_order: matchedRound.round_order,
          scheduled_date: new Date(scheduled_date),
          scheduled_time: scheduled_time ? new Date(`1970-01-01T${scheduled_time}:00Z`) : null,
          end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null,
          duration_minutes: duration_minutes ?? null,
          mode: resolvedMode,
          interview_type: interview_type || null,
          interview_location: interview_location || null,
          meeting_link: meeting_link || null,
          status: 'Scheduled',
          remark: remark || null,
          created_by: currentUser.userId,
        },
      });

      await tx.submission_events.create({
        data: {
          submission_id: dcId,
          event_type: 'interview_scheduled',
          content: remark || `${matchedRound.name} interview scheduled for ${scheduled_date}`,
          created_by: currentUser.userId,
          metadata: { interview_id: created.id, round_id: matchedRound.id, round_name: matchedRound.name, scheduled_date, scheduled_time } as any,
        },
      });

      // Advance the pipeline into "interview_scheduled" if it isn't there yet and isn't
      // past it (won't rewind a candidate already interviewed/further along).
      if (submission.current_status === 'customer_shortlisted' || submission.current_status === 'sent_to_customer') {
        await tx.submissions.update({ where: { id: dcId }, data: { current_status: 'interview_scheduled' } });
      }

      return created;
    });

    return NextResponse.json({ interview: serializeInterview(interview), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/[requestId]/candidates/[dcId]/interviews:', error);
    return NextResponse.json({ error: 'Failed to schedule interview' }, { status: 500 });
  }
}
