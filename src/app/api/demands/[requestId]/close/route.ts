import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canChangeDemandStatus } from '@/lib/auth/demandFulfillmentPermissions';
import { demandCloseSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

// POST /api/demands/[requestId]/close — records closing comments and sets the demand
// to Closure. Open onboarding rows are closed with the same comment. A demand with no
// overdue onboarding can still be closed from the Closure tab.
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const demandId = demand.id;
    if (!canChangeDemandStatus({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to close this demand' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = demandCloseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { closure_feedback, remark } = parsed.data;

    const pendingOnboardings = await prisma.onboardings.findMany({
      where: { demand_id: demandId, closed_at: null },
      select: { id: true },
    });

    await prisma.$transaction([
      ...(pendingOnboardings.length > 0
        ? [prisma.onboardings.updateMany({
            where: { id: { in: pendingOnboardings.map((o) => o.id) } },
            data: { closure_feedback, closed_at: new Date(), remark: remark || null },
          })]
        : []),
      prisma.demands.update({
        where: { id: demandId },
        data: { status: 'Closure', closed_at: new Date(), updated_by: currentUser.userId },
      }),
      prisma.demand_status_events.create({
        data: {
          demand_id: demandId,
          from_status: demand.status,
          to_status: 'Closure',
          remark: remark || closure_feedback,
          created_by: currentUser.userId,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/[requestId]/close:', error);
    return NextResponse.json({ error: 'Failed to close demand' }, { status: 500 });
  }
}
