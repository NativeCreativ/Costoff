import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canLogDemandCall } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { callLogUpdateSchema } from '@/components/demandFulfillment/callLog.schema';
import { isActiveSkillGroup } from '@/lib/demandFulfillment/callLogHelpers';

/**
 * PUT /api/demands/[requestId]/call-logs/[callId] — edit a logged call: result, fail reason,
 * notes, skill group. Allowed any time (client decision, Nov 2026) for anyone who may log calls
 * on the demand; the last editor and time are kept. Changing a call that already put the
 * candidate into Sourcing to "Not fit" does not remove them from the pipeline.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ requestId: string; callId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId, callId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    if (!canLogDemandCall({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to edit calls for this demand' }, { status: 403 });
    }
    const call = await prisma.demand_call_logs.findFirst({ where: { id: callId, demand_id: demand.id }, select: { id: true, skill_group_id: true } });
    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 });

    const parsed = callLogUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });
    }
    const v = parsed.data;
    // A saved group that was deactivated since is grandfathered.
    if (v.skill_group_id && v.skill_group_id !== call.skill_group_id && !(await isActiveSkillGroup(v.skill_group_id))) {
      return NextResponse.json({ error: 'Selected skill group was not found or is inactive' }, { status: 400 });
    }
    await prisma.demand_call_logs.update({
      where: { id: call.id },
      data: {
        outcome: v.outcome,
        fail_reason: v.outcome === 'not_fit' ? v.fail_reason ?? null : null,
        notes: v.notes || null,
        ...(v.skill_group_id !== undefined ? { skill_group_id: v.skill_group_id } : {}),
        updated_by: currentUser.userId,
        updated_at: new Date(),
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PUT /api/demands/[requestId]/call-logs/[callId]:', error);
    return NextResponse.json({ error: 'Failed to update the call' }, { status: 500 });
  }
}
