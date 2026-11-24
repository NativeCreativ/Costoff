import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canUnlockRound, validateInterviewRecord } from '@/lib/demandFulfillment/interviewManagerRules';
import { canManageInterview } from '@/lib/auth/interviewPermissions';
import { canUpdateSelectionStatus } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { isDemandRecruitmentActive } from '@/lib/demandFulfillment/constants';
import { resolveInterviewRounds } from '@/lib/demandFulfillment/interviewConfig';
import { promoteNextBackup } from '@/lib/demandFulfillment/sourcingSlots';
import { z } from 'zod';

const interviewManagerActionSchema = z.object({
  action: z.enum(['save_round', 'add_round', 'delete_round']),
  interview_id: z.string().uuid().optional(),
  round_order: z.number().int().min(1).default(1),
  round_name: z.string().trim().min(1, 'Round name is required').max(100),
  interview_type: z.enum(['Technical', 'Functional', 'Managerial']).default('Technical'),
  scheduled_date: z.string().optional().nullable(),
  scheduled_time: z.string().optional().nullable(),
  mode: z.enum(['Virtual', 'Telephonic', 'In-Person']).default('Virtual'),
  medium: z.enum(['Teams Meeting', 'Slack Meeting', 'Direct_Call', 'Zoom_Meeting']).default('Teams Meeting'),
  status: z.enum(['Scheduled', 'Completed', 'Rescheduled', 'Cancelled']).default('Scheduled'),
  result: z.enum(['Selected', 'Rejected', 'Feedback Awaiting', 'Onhold']).optional().nullable(),
  reason: z.enum(['Candidate_No_Show', 'Panel_No_Show', 'Candidate_Not_Available', 'Client_No_Show', 'Others']).optional().nullable(),
  custom_reason: z.string().trim().max(500).optional().nullable(),
  reject_reason: z.string().trim().max(1000).optional().nullable(),
  comments: z.string().trim().max(2000).optional().nullable(),
  reschedule_date: z.string().optional().nullable(),
  reschedule_time: z.string().optional().nullable(),
});

export async function GET(
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

    const submission = await prisma.submissions.findFirst({
      where: { id: dcId, demand_id: demand.id },
      include: {
        candidates: {
          select: { id: true, full_name: true, email: true, phone: true },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Candidate submission not found' }, { status: 404 });
    }

    // Load template rounds configured for this demand
    const templateRounds = await resolveInterviewRounds(demand.id);

    // Load all current active interviews for this submission
    const currentInterviews = await prisma.interviews.findMany({
      where: {
        submission_id: dcId,
        is_current: true,
      },
      include: {
        rescheduled_interviews: {
          orderBy: { created_at: 'desc' },
          include: {
            profiles_interviews_created_byToprofiles: {
              select: { id: true, full_name: true, email: true },
            },
          },
        },
        profiles_interviews_created_byToprofiles: {
          select: { id: true, full_name: true, email: true },
        },
      },
      orderBy: { round_order: 'asc' },
    });

    // Check if any round was rejected
    const hasRejection = currentInterviews.some((iv) => iv.status === 'Completed' && iv.result === 'Rejected');

    return NextResponse.json({
      success: true,
      candidate: submission.candidates,
      submission: {
        id: submission.id,
        current_status: submission.current_status,
        final_result: submission.final_result,
        is_active: submission.is_active,
      },
      demand: {
        id: demand.id,
        request_id: demand.request_id,
        status: demand.status,
      },
      templateRounds: templateRounds.map((r) => ({
        id: r.id,
        name: r.name,
        round_order: r.round_order,
        mode: r.mode,
      })),
      interviews: currentInterviews.map((iv) => ({
        id: iv.id,
        round_order: iv.round_order ?? 1,
        round_name: iv.level || `Round ${iv.round_order ?? 1}`,
        interview_type: iv.interview_type || 'Technical',
        scheduled_date: iv.scheduled_date ? iv.scheduled_date.toISOString().split('T')[0] : null,
        scheduled_time: iv.scheduled_time ? iv.scheduled_time.toISOString().substring(11, 16) : null,
        mode: iv.mode || 'Virtual',
        medium: iv.medium || 'Teams Meeting',
        status: iv.status || 'Scheduled',
        result: iv.result || null,
        reason: iv.reason || null,
        custom_reason: iv.custom_reason || null,
        reject_reason: iv.reject_reason || null,
        comments: iv.comments || iv.remark || null,
        created_by_name: iv.profiles_interviews_created_byToprofiles?.full_name ?? null,
        created_at: iv.created_at,
        history: iv.rescheduled_interviews.map((h) => ({
          id: h.id,
          scheduled_date: h.scheduled_date ? h.scheduled_date.toISOString().split('T')[0] : null,
          scheduled_time: h.scheduled_time ? h.scheduled_time.toISOString().substring(11, 16) : null,
          status: h.status,
          reason: h.reason,
          custom_reason: h.custom_reason,
          comments: h.comments,
          created_at: h.created_at,
          created_by_name: h.profiles_interviews_created_byToprofiles?.full_name ?? null,
        })),
      })),
      hasRejection,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /interview-manager:', error);
    return NextResponse.json({ error: 'Failed to load interview details' }, { status: 500 });
  }
}

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

    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canManageInterview(actor, demand, demand.recruiterIds) && !canUpdateSelectionStatus(actor, demand)) {
      return NextResponse.json({ error: 'You do not have permission to manage interviews' }, { status: 403 });
    }

    if (!isDemandRecruitmentActive(demand.status)) {
      return NextResponse.json(
        { error: `Interviews cannot be modified because "${requestId}" is inactive.` },
        { status: 400 }
      );
    }

    const submission = await prisma.submissions.findFirst({
      where: { id: dcId, demand_id: demand.id },
      include: { candidates: true },
    });
    if (!submission) {
      return NextResponse.json({ error: 'Candidate submission not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = interviewManagerActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // ── Action: delete_round ───────────────────────────────────────────────
    if (data.action === 'delete_round') {
      if (!data.interview_id) {
        return NextResponse.json({ error: 'Interview ID is required to delete' }, { status: 400 });
      }

      const existing = await prisma.interviews.findUnique({ where: { id: data.interview_id } });
      if (!existing || existing.submission_id !== dcId) {
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
      }

      if (existing.status === 'Completed' && existing.result === 'Selected') {
        return NextResponse.json({ error: 'Cannot delete a completed and selected interview round' }, { status: 400 });
      }

      await prisma.interviews.delete({ where: { id: data.interview_id } });
      return NextResponse.json({ success: true, message: 'Round deleted' });
    }

    // ── Action: add_round ──────────────────────────────────────────────────
    if (data.action === 'add_round') {
      // Find the highest existing round_order for this submission
      const highest = await prisma.interviews.findFirst({
        where: { submission_id: dcId, is_current: true },
        orderBy: { round_order: 'desc' },
      });
      const nextOrder = (highest?.round_order ?? 0) + 1;

      const created = await prisma.interviews.create({
        data: {
          submission_id: dcId,
          demand_id: demand.id,
          candidate_id: submission.candidate_id,
          level: data.round_name,
          round_order: nextOrder,
          interview_type: data.interview_type,
          mode: data.mode,
          medium: data.medium,
          status: 'Scheduled',
          scheduled_date: data.scheduled_date ? new Date(data.scheduled_date) : null,
          scheduled_time: data.scheduled_time ? new Date(`1970-01-01T${data.scheduled_time}:00Z`) : null,
          created_by: currentUser.userId,
          is_current: true,
        },
      });

      return NextResponse.json({ success: true, interview: created });
    }

    // ── Action: save_round ─────────────────────────────────────────────────
    // Validations per Review Comment 14:
    // 1. Validate mandatory fields using shared rules
    const validation = validateInterviewRecord(data);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 2. If Status is Completed, Result is required.
    if (data.status === 'Completed' && !data.result) {
      return NextResponse.json(
        { error: 'Interview result is mandatory when interview is Completed' },
        { status: 400 }
      );
    }

    // 3. Sequential Top-Down Rule: Check prior round completion before saving this round
    if (data.round_order > 1) {
      const priorRound = await prisma.interviews.findFirst({
        where: {
          submission_id: dcId,
          is_current: true,
          round_order: data.round_order - 1,
        },
      });

      if (!canUnlockRound(data.round_order, priorRound ? { status: priorRound.status, result: priorRound.result } : null)) {
        return NextResponse.json(
          { error: `Round ${data.round_order} is locked until Round ${data.round_order - 1} is marked as Selected.` },
          { status: 400 }
        );
      }
    }

    const scheduledDateObj = data.scheduled_date ? new Date(data.scheduled_date) : null;
    const scheduledTimeObj = data.scheduled_time ? new Date(`1970-01-01T${data.scheduled_time}:00Z`) : null;

    const result = await prisma.$transaction(async (tx) => {
      let targetInterviewId = data.interview_id;

      // ── Handle Rescheduled: archive current, create new record ───────────────
      if (data.status === 'Rescheduled') {
        if (!data.reschedule_date) {
          throw new Error('New reschedule date is required when rescheduling an interview');
        }

        let oldRecord = targetInterviewId
          ? await tx.interviews.findUnique({ where: { id: targetInterviewId } })
          : null;

        if (oldRecord) {
          // Archive the current record
          await tx.interviews.update({
            where: { id: oldRecord.id },
            data: {
              status: 'Rescheduled',
              reason: data.reason,
              custom_reason: data.custom_reason || null,
              comments: data.comments || null,
              is_current: false,
              updated_by: currentUser.userId,
            },
          });
        }

        // Create new active attempt for this round
        const newAttempt = await tx.interviews.create({
          data: {
            submission_id: dcId,
            demand_id: demand.id,
            candidate_id: submission.candidate_id,
            level: data.round_name,
            round_order: data.round_order,
            interview_type: data.interview_type,
            mode: data.mode,
            medium: data.medium,
            status: 'Scheduled',
            scheduled_date: new Date(data.reschedule_date),
            scheduled_time: data.reschedule_time ? new Date(`1970-01-01T${data.reschedule_time}:00Z`) : null,
            comments: data.comments || null,
            parent_interview_id: oldRecord?.id ?? null,
            is_current: true,
            created_by: currentUser.userId,
          },
        });

        await tx.submission_events.create({
          data: {
            submission_id: dcId,
            event_type: 'interview_feedback',
            content: `Interview "${data.round_name}" rescheduled to ${data.reschedule_date}. Reason: ${data.reason === 'Others' ? data.custom_reason : data.reason}`,
            created_by: currentUser.userId,
          },
        });

        return newAttempt;
      }

      // ── Normal Create or Update ─────────────────────────────────────────────
      let savedRecord;
      if (targetInterviewId) {
        savedRecord = await tx.interviews.update({
          where: { id: targetInterviewId },
          data: {
            level: data.round_name,
            round_order: data.round_order,
            interview_type: data.interview_type,
            mode: data.mode,
            medium: data.medium,
            scheduled_date: scheduledDateObj,
            scheduled_time: scheduledTimeObj,
            status: data.status,
            result: data.status === 'Completed' ? data.result : null,
            reason: data.status === 'Cancelled' ? data.reason : null,
            custom_reason: data.reason === 'Others' ? data.custom_reason : null,
            reject_reason: (data.status === 'Completed' && data.result === 'Rejected') ? data.reject_reason : null,
            comments: data.comments || null,
            remark: data.comments || null,
            updated_by: currentUser.userId,
          },
        });
      } else {
        savedRecord = await tx.interviews.create({
          data: {
            submission_id: dcId,
            demand_id: demand.id,
            candidate_id: submission.candidate_id,
            level: data.round_name,
            round_order: data.round_order,
            interview_type: data.interview_type,
            mode: data.mode,
            medium: data.medium,
            scheduled_date: scheduledDateObj,
            scheduled_time: scheduledTimeObj,
            status: data.status,
            result: data.status === 'Completed' ? data.result : null,
            reason: data.status === 'Cancelled' ? data.reason : null,
            custom_reason: data.reason === 'Others' ? data.custom_reason : null,
            reject_reason: (data.status === 'Completed' && data.result === 'Rejected') ? data.reject_reason : null,
            comments: data.comments || null,
            remark: data.comments || null,
            created_by: currentUser.userId,
            is_current: true,
          },
        });
      }

      // ── Rejection Cascade Rule: delete/invalidate rows below and mark submission rejected ──
      if (data.status === 'Completed' && data.result === 'Rejected') {
        // Automatically delete rows below as they are not applicable
        await tx.interviews.deleteMany({
          where: {
            submission_id: dcId,
            round_order: { gt: data.round_order },
          },
        });

        // Update candidate submission to rejected
        await tx.submissions.update({
          where: { id: dcId },
          data: {
            current_status: 'rejected',
            final_result: 'Rejected',
            is_active: false,
          },
        });

        await tx.submission_events.create({
          data: {
            submission_id: dcId,
            event_type: 'status_change',
            from_status: submission.current_status,
            to_status: 'rejected',
            content: `Interview "${data.round_name}" result: Rejected. Reason: ${data.reject_reason}`,
            created_by: currentUser.userId,
          },
        });

        // Automatically promote the earliest backup candidate if this was an active profile
        if ((submission.sourcing_type ?? 'active') === 'active') {
          await promoteNextBackup(tx, demand.id, currentUser.userId);
        }
      } else if (data.status === 'Completed' && data.result === 'Selected') {
        // Check if there are further rounds configured
        const totalRounds = await tx.interviews.count({
          where: { submission_id: dcId, is_current: true },
        });

        // If this is the final round or user selected
        await tx.submission_events.create({
          data: {
            submission_id: dcId,
            event_type: 'interview_feedback',
            content: `Interview "${data.round_name}" result: Selected`,
            created_by: currentUser.userId,
          },
        });

        if (data.round_order >= totalRounds) {
          // If all rounds are completed and selected, advance submission status to selected
          await tx.submissions.update({
            where: { id: dcId },
            data: {
              current_status: 'selected',
              final_result: 'Selected',
            },
          });

          await tx.submission_events.create({
            data: {
              submission_id: dcId,
              event_type: 'status_change',
              from_status: submission.current_status,
              to_status: 'selected',
              content: 'All interview rounds completed successfully. Candidate marked as Selected.',
              created_by: currentUser.userId,
            },
          });
        }
      } else {
        await tx.submission_events.create({
          data: {
            submission_id: dcId,
            event_type: 'interview_feedback',
            content: `Interview "${data.round_name}" status updated to ${data.status}`,
            created_by: currentUser.userId,
          },
        });
      }

      return savedRecord;
    });

    return NextResponse.json({ success: true, interview: result });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /interview-manager:', error);
    return NextResponse.json({ error: error.message || 'Failed to save interview' }, { status: 500 });
  }
}
