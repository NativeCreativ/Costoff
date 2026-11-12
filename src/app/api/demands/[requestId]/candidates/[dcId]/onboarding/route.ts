import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { SUPER_ADMIN_SETTINGS_KEYS } from '@/lib/demandFulfillment/constants';

// GET /api/demands/[requestId]/candidates/[dcId]/onboarding — onboarding record for a candidate,
// seeded from the Super Admin document checklist if none exists yet.
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
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const onboarding = await prisma.onboardings.findUnique({
      where: { submission_id: dcId },
      include: { candidates: { select: { full_name: true, email: true, phone: true } } },
    });

    if (onboarding) {
      return NextResponse.json({ onboarding });
    }

    const checklistSetting = await prisma.super_admin_settings.findUnique({
      where: { key: SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist },
    });
    const checklist = Array.isArray(checklistSetting?.value) ? checklistSetting.value : [];

    return NextResponse.json({
      onboarding: null,
      suggestedDocumentsStatus: checklist.map((c: any) => ({ name: c.name, required: c.required, received: false })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/candidates/[dcId]/onboarding:', error);
    return NextResponse.json({ error: 'Failed to load onboarding record' }, { status: 500 });
  }
}
