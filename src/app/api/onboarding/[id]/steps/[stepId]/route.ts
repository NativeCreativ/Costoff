import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { updateOnboardingStepSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadOnboardingStepContext } from '@/lib/onboarding/loadOnboardingStepContext';
import { ONBOARDING_STEP_STATUS_LABELS, type OnboardingStepStatus } from '@/lib/onboarding/onboardingSteps';
import { recordDemandChanges, type FieldChange } from '@/lib/demands/demandChangeLog';

const statusLabel = (status: string | null) =>
  status ? ONBOARDING_STEP_STATUS_LABELS[status as OnboardingStepStatus] ?? status : null;

/**
 * PATCH /api/onboarding/[id]/steps/[stepId] — change one step's status and/or remark, or detach
 * its file. Any step can be updated at any time (order is guidance only). Same gate as every
 * other onboarding write: canManageDemandPipeline. Logged on the demand's change log.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id, stepId } = await params;

    const context = await loadOnboardingStepContext(id, stepId);
    if (!context) return NextResponse.json({ error: 'Onboarding step not found' }, { status: 404 });
    const { step, onboarding, demand } = context;
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: "You do not have permission to manage this demand's pipeline" }, { status: 403 });
    }

    const parsed = updateOnboardingStepSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { status, remark, clear_attachment: clearAttachment } = parsed.data;

    const data: { status?: string; remark?: string | null; completed_at?: Date | null; attachment_url?: null; attachment_name?: null; updated_by: string } = {
      updated_by: currentUser.userId,
    };
    const changes: FieldChange[] = [];
    if (status !== undefined && status !== step.status) {
      data.status = status;
      data.completed_at = status === 'completed' ? new Date() : null;
      changes.push({ field: `Onboarding step: ${step.name}`, old_value: statusLabel(step.status), new_value: statusLabel(status) });
    }
    if (remark !== undefined && (remark || null) !== (step.remark || null)) {
      data.remark = remark || null;
      changes.push({ field: `Onboarding step remark: ${step.name}`, old_value: step.remark, new_value: remark || null });
    }
    if (clearAttachment && step.attachment_url) {
      data.attachment_url = null;
      data.attachment_name = null;
      changes.push({ field: `Onboarding step file: ${step.name}`, old_value: step.attachment_name || 'File', new_value: null });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.onboarding_steps.update({ where: { id: stepId }, data });
      await recordDemandChanges(tx, {
        demandId: demand.id,
        scope: 'candidate',
        changes,
        actorId: currentUser.userId,
        entityId: onboarding.candidate_id,
        entityLabel: onboarding.candidates?.full_name ?? null,
      });
      return row;
    });

    return NextResponse.json({ step: updated, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/onboarding/[id]/steps/[stepId]:', error);
    return NextResponse.json({ error: 'Failed to update the onboarding step' }, { status: 500 });
  }
}
