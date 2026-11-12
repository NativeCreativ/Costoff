import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canDeleteDemand, DEMAND_DELETE_BLOCKED_MESSAGE } from '@/lib/auth/demandPermissions';

const bulkDeleteSchema = z.object({
  demand_ids: z.array(z.string().uuid()).min(1, 'Select at least one demand'),
});

// DELETE /api/demands/bulk-delete — same ownership + status-eligibility rule as the
// single-demand DELETE handler (canDeleteDemand: owner AND status in Closure/Cancelled),
// applied per id so an ineligible demand in the batch is reported, not a hard-fail of
// the whole request — same tolerant-partial-failure shape as bulk-status.
export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { demand_ids } = parsed.data;

    const results: { demand_id: string; request_id?: string; success: boolean; error?: string }[] = [];

    for (const demandId of demand_ids) {
      const demand = await prisma.demands.findUnique({
        where: { id: demandId },
        select: { request_id: true, created_by: true, contact_profile_id: true, status: true },
      });
      if (!demand) {
        results.push({ demand_id: demandId, success: false, error: 'Demand not found' });
        continue;
      }
      if (!canDeleteDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
        results.push({ demand_id: demandId, request_id: demand.request_id, success: false, error: DEMAND_DELETE_BLOCKED_MESSAGE });
        continue;
      }
      try {
        await prisma.demands.delete({ where: { id: demandId } });
        results.push({ demand_id: demandId, request_id: demand.request_id, success: true });
      } catch (dbError) {
        results.push({
          demand_id: demandId,
          request_id: demand.request_id,
          success: false,
          error: dbError instanceof Error ? dbError.message : 'Failed to delete demand',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ success: successCount > 0, successCount, failureCount: results.length - successCount, results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/demands/bulk-delete:', error);
    return NextResponse.json({ error: 'Failed to bulk-delete demands' }, { status: 500 });
  }
}
