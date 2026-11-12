import { NextResponse } from 'next/server';
import { storeUpload } from '@/lib/storage/uploadStorage';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { uploadOnboardingDocumentSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { normalizeOnboardingChecklist, SUPER_ADMIN_SETTINGS_KEYS } from '@/lib/demandFulfillment/constants';

// POST /api/onboarding/[id]/documents — record a received document, updating the
// documents_status jsonb checklist (matched by name; appended if not already present).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const name = String(form.get('name') || '').trim();
      const file = form.get('file');
      if (!name || !(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: 'Choose a file and a document name' }, { status: 400 });
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Keep each document under 8 MB' }, { status: 400 });
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      // Disk locally, Netlify Blobs on the live site (uploadStorage.ts).
      const url = await storeUpload(`onboarding/${id}/${Date.now()}-${safeName}`, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        fileName: file.name.slice(0, 255),
      });
      const existingDocs = Array.isArray(onboarding.documents_status) ? onboarding.documents_status as { name: string; required?: boolean; received?: boolean; url?: string }[] : [];
      const nextDocs = existingDocs.some((doc) => doc.name === name)
        ? existingDocs.map((doc) => doc.name === name ? { ...doc, received: true, url } : doc)
        : [...existingDocs, { name, required: false, received: true, url }];
      const updated = await prisma.onboardings.update({
        where: { id },
        data: { documents_status: nextDocs },
      });
      return NextResponse.json({ onboarding: updated, success: true });
    }

    const body = await request.json();
    const parsed = uploadOnboardingDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, url, remark } = parsed.data;

    // The document name must come from the active onboarding checklist, or be a
    // document already recorded on this record (grandfather). A new inactive
    // name is rejected rather than appended.
    const checklist = normalizeOnboardingChecklist((await prisma.super_admin_settings.findUnique({
      where: { key: SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist },
    }))?.value ?? []);
    const activeNames = checklist.filter((c) => c.isActive).map((c) => c.name.trim().toLowerCase());
    const savedNames = ((onboarding.documents_status as Array<{ name?: string }> | null) ?? [])
      .map((d) => (d?.name ?? '').trim().toLowerCase());
    const normalizedName = name.trim().toLowerCase();
    if (!activeNames.includes(normalizedName) && !savedNames.includes(normalizedName)) {
      return NextResponse.json({ error: 'Onboarding document is inactive or not configured' }, { status: 400 });
    }

    const currentChecklist = Array.isArray(onboarding.documents_status) ? (onboarding.documents_status as any[]) : [];
    const idx = currentChecklist.findIndex((d) => d.name === name);
    const nextChecklist =
      idx >= 0
        ? currentChecklist.map((d, i) => (i === idx ? { ...d, received: true, url } : d))
        : [...currentChecklist, { name, required: false, received: true, url }];

    const [updated] = await prisma.$transaction([
      prisma.onboardings.update({ where: { id }, data: { documents_status: nextChecklist } }),
      prisma.submission_events.create({
        data: {
          submission_id: onboarding.submission_id!,
          event_type: 'document_uploaded',
          content: remark || `Document received: ${name}`,
          attachment_url: url,
          created_by: currentUser.userId,
          metadata: { document_name: name } as any,
        },
      }),
    ]);

    return NextResponse.json({ onboarding: updated, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/onboarding/[id]/documents:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
