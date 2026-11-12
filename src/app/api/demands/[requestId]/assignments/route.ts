import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

// GET /api/demands/[requestId]/assignments — full assignment history for a demand.
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

    const assignments = await prisma.demand_assignments.findMany({
      where: { demand_id: demand.id },
      include: {
        profiles_demand_assignments_user_idToprofiles: { select: { id: true, full_name: true, email: true, role: true } },
        profiles_demand_assignments_assigned_byToprofiles: { select: { id: true, full_name: true } },
      },
      orderBy: { assigned_at: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/assignments:', error);
    return NextResponse.json({ assignments: [] }, { status: 500 });
  }
}
