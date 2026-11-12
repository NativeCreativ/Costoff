import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { updateOnboardingSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { normalizeOnboardingChecklist, SUPER_ADMIN_SETTINGS_KEYS } from '@/lib/demandFulfillment/constants';
import { isOnboardingStepDone } from '@/lib/onboarding/onboardingSteps';

// PATCH /api/onboarding/[id] — update documents_status, bgv_status, joined_at, offer dates.
// `id` is the onboardings.id (not the submission id — see the nested
// /demands/[id]/candidates/[dcId]/onboarding route for lookup-by-candidate).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;

    const onboarding = await prisma.onboardings.findUnique({ where: { id } });
    if (!onboarding || !onboarding.demand_id) {
      return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
    }

    const demand = await loadDemandContext(onboarding.demand_id);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to manage this demand\'s pipeline' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { documents_status, bgv_status, bgv_remark, offer_released_at, offer_accepted_at, joined_at, remark } = parsed.data;

    // Onboarding document names come from the Demand Fulfillment Settings checklist.
    // A name that is no longer ACTIVE may stay only if it is already saved on
    // this record (grandfather) — never added fresh.
    if (documents_status !== undefined) {
      const checklist = normalizeOnboardingChecklist((await prisma.super_admin_settings.findUnique({
        where: { key: SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist },
      }))?.value ?? []);
      const activeNames = checklist.filter((c) => c.isActive).map((c) => c.name.trim().toLowerCase());
      const savedNames = ((onboarding.documents_status as Array<{ name?: string }> | null) ?? [])
        .map((d) => (d?.name ?? '').trim().toLowerCase());
      const invalid = documents_status
        .map((d) => d.name.trim().toLowerCase())
        .filter((name) => !activeNames.includes(name) && !savedNames.includes(name));
      if (invalid.length > 0) {
        return NextResponse.json({ error: 'Onboarding document is inactive or not configured' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (documents_status !== undefined) updateData.documents_status = documents_status;
    if (bgv_status !== undefined) updateData.bgv_status = bgv_status;
    if (bgv_remark !== undefined) updateData.bgv_remark = bgv_remark || null;
    if (offer_released_at !== undefined) updateData.offer_released_at = offer_released_at ? new Date(offer_released_at) : null;
    if (offer_accepted_at !== undefined) updateData.offer_accepted_at = offer_accepted_at ? new Date(offer_accepted_at) : null;
    if (joined_at !== undefined) updateData.joined_at = joined_at ? new Date(joined_at) : null;
    if (remark !== undefined) updateData.remark = remark || null;

    // Default behavior (configurable to "block" later if required): warn, don't block,
    // when marking Joined without all required documents received.
    let warning: string | null = null;
    if (joined_at) {
      // Onboardings with ordered steps warn on open steps; older ones keep the document rule.
      const steps = await prisma.onboarding_steps.findMany({ where: { onboarding_id: id }, select: { status: true } });
      if (steps.length > 0) {
        const open = steps.filter((s) => !isOnboardingStepDone(s.status)).length;
        if (open > 0) warning = `${open} onboarding step${open === 1 ? ' is' : 's are'} not completed yet.`;
      } else {
        const docs = (documents_status ?? (onboarding.documents_status as any[]) ?? []) as { required: boolean; received?: boolean }[];
        const missingRequired = docs.some((d) => d.required && !d.received);
        if (missingRequired) warning = 'Some required documents have not been received yet.';
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.onboardings.update({ where: { id }, data: updateData });

      if (bgv_status !== undefined) {
        await tx.submission_events.create({
          data: {
            submission_id: onboarding.submission_id!,
            event_type: 'bgv_update',
            content: bgv_remark || remark || `BGV status: ${bgv_status}`,
            created_by: currentUser.userId,
          },
        });
      }
      if (documents_status !== undefined) {
        await tx.submission_events.create({
          data: {
            submission_id: onboarding.submission_id!,
            event_type: 'document_uploaded',
            content: remark || 'Onboarding document checklist updated',
            created_by: currentUser.userId,
            metadata: { documents_status } as any,
          },
        });
      }

      return result;
    });

    return NextResponse.json({ onboarding: updated, warning, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/onboarding/[id]:', error);
    return NextResponse.json({ error: 'Failed to update onboarding record' }, { status: 500 });
  }
}
