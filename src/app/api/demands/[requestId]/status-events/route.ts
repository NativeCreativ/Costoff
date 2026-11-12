import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

// GET /api/demands/[requestId]/status-events — demand-level status transition history,
// shown as the Overview tab's status timeline.
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const events = await prisma.demand_status_events.findMany({
      where: { demand_id: demand.id },
      include: { profiles: { select: { id: true, full_name: true, role: true } } },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/status-events:', error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
