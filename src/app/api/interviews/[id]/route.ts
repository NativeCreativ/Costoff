import { appendStampedLine } from '@/lib/logStamp';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canEditInterview, interviewEditBlockReason, canViewInterview } from '@/lib/auth/interviewPermissions';
import { canUpdateSelectionStatus } from '@/lib/auth/demandFulfillmentPermissions';
import { INTERVIEW_COMPLETED_STATUS } from '@/constants/options';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { updateInterviewSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { interviewStatusError, loadInterviewStatuses, statusRequiresResult } from '@/lib/interviewStatuses';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { getDemandOwnInterviewRounds, resolveInterviewModes } from '@/lib/demandFulfillment/interviewConfig';
import { isAllowedListValue } from '@/lib/settingsListValidation';
import { serializeInterview } from '@/lib/serializeInterview';

// GET /api/interviews/[id] — fetch single interview detail, gated by central visibility policy.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    const interview = await prisma.interviews.findUnique({
      where: { id },
      include: {
        candidates: { select: { full_name: true, email: true, phone: true } },
        demands: {
          select: {
            request_id: true, job_title: true, skill_description: true, client_name: true,
            company_name: true, company_email: true, company_id: true,
            created_by: true, contact_profile_id: true, spoc_profile_id: true,
            companies: { select: { id: true, name: true, client_name: true, email: true } },
            profiles_demands_contact_profileToprofiles: { select: { id: true, full_name: true, email: true } },
            demand_ta_allocations: { select: { ta_id: true } },
          },
        },
        profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
      },
    });

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canViewInterview(actor, interview)) {
      return NextResponse.json({ error: 'You do not have permission to view this interview' }, { status: 403 });
    }

    const { demands: demandRow, ...rest } = interview;
    return NextResponse.json({
      interview: {
        ...serializeInterview(rest),
        candidate_name: interview.candidates?.full_name ?? null,
        candidate_email: interview.candidates?.email ?? null,
        demand_request_id: demandRow?.request_id ?? null,
        demand_job_title: demandRow?.job_title ?? null,
        client_company_name: demandRow?.companies?.name || demandRow?.company_name || null,
        client_name: demandRow?.companies?.client_name || demandRow?.client_name || null,
        client_company_email: demandRow?.companies?.email || demandRow?.company_email || null,
        am_name: demandRow?.profiles_demands_contact_profileToprofiles?.full_name || null,
        am_email: demandRow?.profiles_demands_contact_profileToprofiles?.email || null,
        created_by_name: interview.profiles_interviews_created_byToprofiles?.full_name ?? null,
        created_by_email: interview.profiles_interviews_created_byToprofiles?.email ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/interviews/[id]:', error);
    return NextResponse.json({ error: 'Failed to fetch interview' }, { status: 500 });
  }
}

// PATCH /api/interviews/[id] — update status/feedback/result/reschedule for a scheduled interview.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;

    const interview = await prisma.interviews.findUnique({
      where: { id },
      include: { demands: { select: { contact_profile_id: true, spoc_profile_id: true } } },
    });
    if (!interview || !interview.demand_id) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canViewInterview(actor, interview)) {
      return NextResponse.json({ error: 'You do not have permission to view this interview' }, { status: 403 });
    }
    // Edit eligibility is decided by THIS interview's own STATUS, regardless of its result
    // (Pass / Fail / On Hold) and regardless of a candidate's other rounds. This mirrors
    // getInterviewRowActions, so a hidden Edit button and this 409 can never disagree.
    if (interview.status === INTERVIEW_COMPLETED_STATUS) {
      return NextResponse.json(
        { error: 'A completed interview cannot be edited. Use the admin correction process if this was recorded in error.', blocked: true },
        { status: 409 }
      );
    }

    const demand = await loadDemandContext(interview.demand_id);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const creatorIsRecruiter = (await recruiterProfileIds([interview.created_by])).has(interview.created_by ?? '');
    const selectionStatusOk = canUpdateSelectionStatus(
      { role: currentUser.role, id: currentUser.userId },
      demand
    );
    if (!canEditInterview(actor, demand, demand.recruiterIds, interview.created_by, creatorIsRecruiter) && !selectionStatusOk) {
      return NextResponse.json(
        { error: interviewEditBlockReason(actor, demand.recruiterIds, interview.created_by, creatorIsRecruiter) ?? 'You do not have permission to manage interviews for this requirement' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateInterviewSchema.safeParse(body);
    if (!parsed.success) {
      // Show the cross-field refine message ("Select a Result when marking an interview
      // Completed") rather than a generic "Validation failed" — the inline panel and the
      // Edit modal both surface `error` to the user.
      const firstIssue = parsed.error.issues[0];
      const message = firstIssue && firstIssue.path.length > 0 ? firstIssue.message : 'Validation failed';
      return NextResponse.json({ error: message, details: parsed.error.flatten() }, { status: 400 });
    }
    const {
      status, mode, feedback, result, round_id, scheduled_date, scheduled_time, end_time, duration_minutes,
      meeting_link, remark, interview_type, interview_location, log_comment,
    } = parsed.data;

    let matchedRound: { id: string; name: string; mode?: string | null; round_order: number } | undefined;
    if (round_id !== undefined && round_id !== interview.round_id) {
      // Interview Round is sourced from THIS demand's own saved rounds only — never
      // company/global, and never free-typed. Changing the round must still resolve to a
      // real row belonging to that demand, never keeping an invalid Round -> Demand
      // relationship. An UNCHANGED round_id (the common case: the user edited something
      // else and resubmitted the whole form) is never re-validated here, so an old
      // schedule whose round the demand no longer has keeps loading and saving fine —
      // only picking a genuinely different round can fail this check.
      const rounds = await getDemandOwnInterviewRounds(demand.id);
      matchedRound = rounds.find((r) => r.id === round_id);
      if (!matchedRound) {
        return NextResponse.json(
          { error: 'The selected Interview Round is not configured for this demand', availableRounds: rounds.map((r) => ({ id: r.id, name: r.name })) },
          { status: 400 }
        );
      }
    }

    // Interview Mode follows the settings list: an inactive mode is rejected
    // unless the interview already carries that exact saved value (grandfather). This only
    // applies when the caller explicitly sends `mode` — the global Interviews & Schedules
    // form never does (Round and Mode are one field there; see the auto-derivation below).
    if (mode !== undefined) {
      const activeModes = await resolveInterviewModes();
      const selectionModes = ['InPerson', 'Video'];
      if (!selectionModes.includes(mode) && !isAllowedListValue(mode, interview.mode, activeModes)) {
        return NextResponse.json({ error: 'Selected interview mode is inactive or not configured' }, { status: 400 });
      }
    }

    const statusCatalog = await loadInterviewStatuses(true);
    if (status !== undefined) {
      const statusError = interviewStatusError(status, interview.status, statusCatalog, true);
      if (statusError) return NextResponse.json({ error: statusError }, { status: 400 });
      const nextRequiresResult = statusRequiresResult(status, statusCatalog);
      if (nextRequiresResult && !result) {
        return NextResponse.json({ error: 'Select a Result when marking an interview with this status' }, { status: 400 });
      }
    }

    const updateData: any = { updated_by: currentUser.userId };
    if (status !== undefined) updateData.status = status;
    if (mode !== undefined) {
      updateData.mode = mode;
    } else if (matchedRound) {
      // Round and Mode are one field in the global form: when the round actually changes and
      // no explicit mode was sent, the NEW round's own mode travels with it automatically —
      // a plain-text snapshot, never re-read from the round after this save.
      updateData.mode = matchedRound.mode ?? '';
    }
    // A Result describes an interview that already happened, so it only ever belongs on a
    // Completed interview (updateInterviewSchema enforces that pair). Moving to any other
    // status — including back to Scheduled for a re-schedule — clears it, so a stale
    // pass/fail can never sit beside a re-booked slot.
    if (result !== undefined) updateData.result = result;
    if (status !== undefined && !statusRequiresResult(status, statusCatalog)) {
      updateData.result = null;
    }
    if (feedback !== undefined) updateData.feedback = feedback;
    if (interview_type !== undefined) updateData.interview_type = interview_type;
    if (interview_location !== undefined) updateData.interview_location = interview_location;
    if (matchedRound) {
      updateData.round_id = matchedRound.id;
      updateData.level = matchedRound.name; // denormalized display copy, derived from round_id
      updateData.round_order = matchedRound.round_order;
    }
    if (scheduled_date !== undefined) updateData.scheduled_date = new Date(scheduled_date);
    if (scheduled_time !== undefined) updateData.scheduled_time = scheduled_time ? new Date(`1970-01-01T${scheduled_time}:00Z`) : null;
    if (end_time !== undefined) updateData.end_time = end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null;
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (meeting_link !== undefined) updateData.meeting_link = meeting_link || null;
    if (remark !== undefined) updateData.remark = remark || null;
    if (log_comment) {
      // Interview log: each comment is a new line stamped with when and who (review batch 5).
      const author = await prisma.profiles.findUnique({ where: { id: currentUser.userId }, select: { full_name: true } });
      const current = await prisma.interviews.findUnique({ where: { id: interview.id }, select: { feedback: true } });
      updateData.feedback = appendStampedLine(current?.feedback, log_comment, author?.full_name);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updated_ = await tx.interviews.update({
        where: { id },
        data: updateData,
        include: {
          profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
        },
      });

      // Only interviews scheduled from a candidate's pipeline (via the demand pipeline's
      // "Schedule Interview") carry a submission_id — one scheduled directly from the global
      // Interviews screen may not be linked to a submission, and submission_events.submission_id
      // is a required FK, so logging this event would otherwise throw and fail the whole update.
      if ((feedback !== undefined || result !== undefined || status !== undefined) && interview.submission_id) {
        await tx.submission_events.create({
          data: {
            submission_id: interview.submission_id,
            event_type: 'interview_feedback',
            content: remark || feedback || `Interview ${status ?? ''} ${result ? `— result: ${result}` : ''}`.trim(),
            created_by: currentUser.userId,
            // round_name is carried in metadata so the timeline can say WHICH round the
            // status/result refers to. `level` is the denormalized copy of the round name.
            metadata: {
              interview_id: id,
              status,
              result,
              round_id: updated_.round_id ?? interview.round_id ?? null,
              round_name: updated_.level ?? interview.level ?? null,
            } as any,
          },
        });
      }

      // Passing the final configured round advances the candidate to 'interviewed'.
      if (result === 'pass' && interview.submission_id) {
        const submission = await tx.submissions.findUnique({ where: { id: interview.submission_id } });
        if (submission && submission.current_status === 'interview_scheduled') {
          await tx.submissions.update({ where: { id: interview.submission_id }, data: { current_status: 'interviewed' } });
        }
      }

      return updated_;
    });

    return NextResponse.json({ interview: serializeInterview(updated), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/interviews/[id]:', error);
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}
