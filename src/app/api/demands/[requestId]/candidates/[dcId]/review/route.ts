import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import {
  canReviewSourcedProfile,
  canSubmitSourcedProfile,
  canSpocReviewProfile,
  canAmReviewProfile,
} from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { sourcingReviewSchema } from '@/components/demandFulfillment/demandFulfillment.schema';

/**
 * POST /api/demands/[requestId]/candidates/[dcId]/review — Sourcing Save → Submit → Approve /
 * Reject (review batch 4, Nov 2026).
 *
 *  submit / submit_as_active  sourced → submitted_to_spoc. Whoever manages the pipeline or uploaded
 *                             the profile. Notifies the demand's AM and SPOC. submit_as_active
 *                             also flips a Backup profile to Active (re-submitting a backup).
 *  approve                    submitted_to_spoc → shortlisted_internal (AM / SPOC / Super Admin).
 *  reject                     submitted_to_spoc → sourced with review_state 'rejected' and the
 *                             reason, so the TA can fix the details and submit again.
 * Approve / reject notify whoever submitted the profile. Every step is a submission_events row.
 */
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string; dcId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId, dcId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    const actor = { role: currentUser.role, id: currentUser.userId };

    const submission = await prisma.submissions.findFirst({
      where: { id: dcId, demand_id: demand.id, is_active: true },
      select: {
        id: true, current_status: true, added_by: true, submitted_by_ta: true, sourcing_type: true,
        candidates: { select: { full_name: true } },
      },
    });
    if (!submission) return NextResponse.json({ error: 'Candidate not found in this demand' }, { status: 404 });

    const parsed = sourcingReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });
    }
    const { action, remark } = parsed.data;
    const isSubmit = action === 'submit' || action === 'submit_as_active';
    const candidateName = submission.candidates?.full_name || 'A candidate';
    const actorProfile = await prisma.profiles.findUnique({ where: { id: currentUser.userId }, select: { full_name: true } });
    const actorName = actorProfile?.full_name || 'Someone';

    let toStatus: string;
    let reviewState: string | null = null;
    let eventContent: string;
    let notificationTitle: string;
    let notificationMessage: string;
    let notificationRecipients: (string | null | undefined)[] = [];

    const isNiche = !!demand.is_niche;

    if (isSubmit) {
      if (!canSubmitSourcedProfile(actor, demand, demand.recruiterIds, submission)) {
        return NextResponse.json({ error: 'You do not have permission to submit this profile' }, { status: 403 });
      }
      if (submission.current_status !== 'sourced') {
        return NextResponse.json({ error: 'Only a saved (not yet submitted) profile can be submitted' }, { status: 400 });
      }
      toStatus = 'submitted_to_spoc';
      reviewState = null;
      eventContent = action === 'submit_as_active' ? 'Submitted for review (re-submitted as Active)' : 'Submitted for review';
      notificationTitle = `Profile submitted on ${demand.request_id}`;
      notificationMessage = `${actorName} submitted ${candidateName} for review.`;
      notificationRecipients = isNiche ? [demand.spoc_profile_id] : [demand.contact_profile_id, demand.spoc_profile_id];
    } else if (action === 'approve') {
      if (isNiche) {
        if (submission.current_status === 'submitted_to_spoc') {
          if (!canSpocReviewProfile(actor, demand)) {
            return NextResponse.json({ error: 'Only the assigned SPOC (or Super Admin) can approve this profile to forward to AM' }, { status: 403 });
          }
          toStatus = 'submitted_to_am';
          reviewState = 'spoc_approved';
          eventContent = remark ? `SPOC Approved: ${remark}` : 'SPOC Approved (Forwarded to AM)';
          notificationTitle = `Profile SPOC-approved on ${demand.request_id}`;
          notificationMessage = `${actorName} approved ${candidateName}. Pending your AM approval.`;
          notificationRecipients = [demand.contact_profile_id];
        } else if (submission.current_status === 'submitted_to_am') {
          if (!canAmReviewProfile(actor, demand)) {
            return NextResponse.json({ error: 'Only the demand’s Account Manager (or Super Admin) can approve this profile into Shortlist' }, { status: 403 });
          }
          toStatus = 'shortlisted_internal';
          reviewState = 'am_approved';
          eventContent = remark ? `AM Approved: ${remark}` : 'AM Approved (Shortlisted Internal)';
          notificationTitle = `Profile approved on ${demand.request_id}`;
          notificationMessage = `${actorName} approved ${candidateName}. They are now in Shortlist.`;
          notificationRecipients = [submission.submitted_by_ta ?? submission.added_by, demand.spoc_profile_id];
        } else {
          return NextResponse.json({ error: 'Only a profile in submitted_to_spoc or submitted_to_am can be approved' }, { status: 400 });
        }
      } else {
        if (!canReviewSourcedProfile(actor, demand)) {
          return NextResponse.json({ error: 'Only the demand’s Account Manager or SPOC can approve or reject a profile' }, { status: 403 });
        }
        if (submission.current_status !== 'submitted_to_spoc') {
          return NextResponse.json({ error: 'Only a submitted profile can be approved or rejected' }, { status: 400 });
        }
        toStatus = 'shortlisted_internal';
        reviewState = null;
        eventContent = remark ? `Approved: ${remark}` : 'Approved';
        notificationTitle = `Profile approved on ${demand.request_id}`;
        notificationMessage = `${actorName} approved ${candidateName}. They are now in Shortlist.`;
        notificationRecipients = [submission.submitted_by_ta ?? submission.added_by];
      }
    } else {
      // action === 'reject'
      if (isNiche) {
        if (submission.current_status === 'submitted_to_spoc') {
          if (!canSpocReviewProfile(actor, demand)) {
            return NextResponse.json({ error: 'Only the assigned SPOC (or Super Admin) can reject this profile' }, { status: 403 });
          }
          eventContent = `SPOC Rejected: ${remark}`;
          notificationMessage = `${actorName} rejected ${candidateName}: ${remark}. Update the details and submit again.`;
          notificationRecipients = [submission.submitted_by_ta ?? submission.added_by];
        } else if (submission.current_status === 'submitted_to_am') {
          if (!canAmReviewProfile(actor, demand)) {
            return NextResponse.json({ error: 'Only the demand’s Account Manager (or Super Admin) can reject this profile' }, { status: 403 });
          }
          eventContent = `AM Rejected: ${remark}`;
          notificationMessage = `${actorName} rejected ${candidateName}: ${remark}. Update the details and submit again.`;
          notificationRecipients = [submission.submitted_by_ta ?? submission.added_by, demand.spoc_profile_id];
        } else {
          return NextResponse.json({ error: 'Only a profile in submitted_to_spoc or submitted_to_am can be rejected' }, { status: 400 });
        }
      } else {
        if (!canReviewSourcedProfile(actor, demand)) {
          return NextResponse.json({ error: 'Only the demand’s Account Manager or SPOC can approve or reject a profile' }, { status: 403 });
        }
        if (submission.current_status !== 'submitted_to_spoc') {
          return NextResponse.json({ error: 'Only a submitted profile can be approved or rejected' }, { status: 400 });
        }
        eventContent = `Rejected: ${remark}`;
        notificationMessage = `${actorName} rejected ${candidateName}: ${remark}. Update the details and submit again.`;
        notificationRecipients = [submission.submitted_by_ta ?? submission.added_by];
      }
      toStatus = 'sourced';
      reviewState = 'rejected';
      notificationTitle = `Profile rejected on ${demand.request_id}`;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.submissions.update({
        where: { id: submission.id },
        data: isSubmit
          ? {
              current_status: toStatus,
              review_state: null,
              submitted_for_review_at: now,
              ...(currentUser.role === 'ta' ? { submitted_by_ta: currentUser.userId } : {}),
              ...(action === 'submit_as_active' ? { sourcing_type: 'active' } : {}),
              updated_at: now,
            }
          : {
              current_status: toStatus,
              review_state: reviewState,
              review_remark: remark || null,
              reviewed_by: currentUser.userId,
              reviewed_at: now,
              updated_at: now,
            },
      });

      await tx.submission_events.create({
        data: {
          submission_id: submission.id,
          event_type: 'status_change',
          from_status: submission.current_status,
          to_status: toStatus,
          content: eventContent,
          created_by: currentUser.userId,
        },
      });

      // Notifications. Never to the actor themself.
      const userIds = [...new Set(notificationRecipients.filter((id): id is string => !!id && id !== currentUser.userId))];
      if (userIds.length > 0) {
        await tx.notifications.createMany({
          data: userIds.map((userId) => ({
            user_id: userId,
            type: isSubmit ? 'profile_submitted' : 'profile_reviewed',
            title: notificationTitle,
            message: notificationMessage,
            entity_type: 'demand',
            entity_id: demand.id,
            dedupe_key: `${isSubmit ? 'profile_submitted' : 'profile_reviewed'}:${submission.id}:${userId}:${now.getTime()}`,
          })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ success: true, current_status: toStatus });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/demands/[requestId]/candidates/[dcId]/review:', error);
    return NextResponse.json({ error: 'Failed to update the profile' }, { status: 500 });
  }
}
