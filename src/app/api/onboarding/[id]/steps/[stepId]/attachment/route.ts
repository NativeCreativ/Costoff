import { NextResponse } from 'next/server';
import { storeUpload } from '@/lib/storage/uploadStorage';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { loadOnboardingStepContext } from '@/lib/onboarding/loadOnboardingStepContext';
import { recordDemandChanges } from '@/lib/demands/demandChangeLog';

const MAX_STEP_FILE_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/onboarding/[id]/steps/[stepId]/attachment (multipart: file) — attach the step's
 * document. Stored next to the onboarding's other files, the same way the old document checklist
 * stored them. Replacing keeps the previous file on disk; only the step's link changes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id, stepId } = await params;

    const context = await loadOnboardingStepContext(id, stepId);
    if (!context) return NextResponse.json({ error: 'Onboarding step not found' }, { status: 404 });
    const { step, onboarding, demand } = context;
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: "You do not have permission to manage this demand's pipeline" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
    }
    if (file.size > MAX_STEP_FILE_BYTES) {
      return NextResponse.json({ error: 'Keep each document under 8 MB' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'document';
    // Disk locally, Netlify Blobs on the live site (uploadStorage.ts).
    const url = await storeUpload(`onboarding/${id}/steps/${stepId}/${Date.now()}-${safeName}`, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      fileName: file.name.slice(0, 255),
    });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.onboarding_steps.update({
        where: { id: stepId },
        data: { attachment_url: url, attachment_name: file.name.slice(0, 255), updated_by: currentUser.userId },
      });
      await recordDemandChanges(tx, {
        demandId: demand.id,
        scope: 'candidate',
        changes: [{ field: `Onboarding step file: ${step.name}`, old_value: step.attachment_name, new_value: file.name.slice(0, 255) }],
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
    console.error('Error in POST /api/onboarding/[id]/steps/[stepId]/attachment:', error);
    return NextResponse.json({ error: 'Failed to upload the document' }, { status: 500 });
  }
}
