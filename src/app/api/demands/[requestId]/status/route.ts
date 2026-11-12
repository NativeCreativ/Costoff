import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canChangeDemandStatus } from '@/lib/auth/demandFulfillmentPermissions';
import { demandStatusChangeSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { checkDemandStatusTransition } from '@/lib/demandFulfillment/statusTransitions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { DEMAND_LIFECYCLE_STATUS_VALUES } from '@/lib/demandFulfillment/constants';

// PATCH /api/demands/[requestId]/status — the single endpoint for every demand-level status
// transition: forward/backward moves, On Hold, Resume (returns to previous_status),
// Cancel, and Reopen. Every transition is recorded in demand_status_events.
export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const demandId = demand.id;
    if (!canChangeDemandStatus({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to change this demand\'s status' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = demandStatusChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    let { to_status, remark } = parsed.data;

    // "Resume" convenience: caller may pass to_status: 'Resume' to fall back to the
    // status the demand held before it was put On Hold (tracked via the most recent
    // demand_status_events row whose to_status was 'On Hold').
    if (to_status === 'Resume') {
      const lastHold = await prisma.demand_status_events.findFirst({
        where: { demand_id: demandId, to_status: 'On Hold' },
        orderBy: { created_at: 'desc' },
      });
      if (!lastHold?.from_status) {
        return NextResponse.json({ error: 'No previous status found to resume to' }, { status: 400 });
      }
      to_status = lastHold.from_status;
    }

    const lifecycleValues: readonly string[] = DEMAND_LIFECYCLE_STATUS_VALUES;
    if (!lifecycleValues.includes(to_status) && !['On Hold', 'Cancelled'].includes(to_status)) {
      return NextResponse.json({ error: 'Invalid target status' }, { status: 400 });
    }

    const check = checkDemandStatusTransition(demand.status, to_status, remark);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason || 'Transition not allowed', requiresRemark: check.requiresRemark }, { status: 400 });
    }

    const [, event] = await prisma.$transaction([
      prisma.demands.update({
        where: { id: demandId },
        data: { status: to_status, updated_by: currentUser.userId },
      }),
      prisma.demand_status_events.create({
        data: {
          demand_id: demandId,
          from_status: demand.status,
          to_status,
          remark: remark || null,
          created_by: currentUser.userId,
        },
      }),
    ]);

    return NextResponse.json({ success: true, status: to_status, event });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/demands/[requestId]/status:', error);
    return NextResponse.json({ error: 'Failed to change demand status' }, { status: 500 });
  }
}
