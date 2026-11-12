import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { SUPER_ADMIN_SETTINGS_KEYS, normalizeOnboardingChecklist } from '@/lib/demandFulfillment/constants';

// PUT /api/admin/settings/demand-fulfillment/onboarding-documents/[name]/toggle — Super Admin only.
// Toggles the isActive flag for one item in the onboarding_document_checklist JSON list.
export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { name } = await params;
    const body = await request.json();
    const isActive = Boolean(body?.is_active);

    const existing = await prisma.super_admin_settings.findUnique({
      where: { key: SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist },
    });
    const items = normalizeOnboardingChecklist(existing?.value ?? []);
    const target = items.find((i) => i.name === name);
    if (!target) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const next = items.map((i) => (i.name === name ? { ...i, isActive } : i));
    await prisma.super_admin_settings.upsert({
      where: { key: SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist },
      update: { value: next as any },
      create: { key: SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist, value: next as any },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT .../onboarding-documents/[name]/toggle:', error);
    return NextResponse.json({ error: 'Failed to toggle document' }, { status: 500 });
  }
}
