import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canChangeDemandStatus } from '@/lib/auth/demandFulfillmentPermissions';
import { checkDemandStatusTransition } from '@/lib/demandFulfillment/statusTransitions';
import { ALL_DEMAND_STATUS_VALUES } from '@/lib/demandFulfillment/constants';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

// Remark is always mandatory (min length) for bulk changes, enforced server-side.
const MIN_REMARK_LENGTH = 10;

const bulkStatusSchema = z.object({
  demand_ids: z.array(z.string().uuid()).min(1, 'Select at least one demand'),
  to_status: z.enum(ALL_DEMAND_STATUS_VALUES as [string, ...string[]]),
  remark: z
    .string()
    .trim()
    .min(MIN_REMARK_LENGTH, `Remark must be at least ${MIN_REMARK_LENGTH} characters`),
});

// PATCH /api/demands/bulk-status — AM/Super Admin only. Applies the same status
// transition to every selected demand, skipping (and reporting) any the actor
// doesn't own or where the transition itself is invalid (e.g. missing remark on
// a reversal) rather than failing the whole batch.
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'account_manager') {
      return NextResponse.json({ error: 'Only Account Managers and Super Admin can bulk-change demand status' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { demand_ids, to_status, remark } = parsed.data;

    const results: { demand_id: string; request_id?: string; success: boolean; error?: string }[] = [];

    for (const demandId of demand_ids) {
      const demand = await loadDemandContext(demandId);
      if (!demand) {
        results.push({ demand_id: demandId, success: false, error: 'Demand not found' });
        continue;
      }
      if (!canChangeDemandStatus({ role: currentUser.role, id: currentUser.userId }, demand)) {
        results.push({ demand_id: demandId, request_id: demand.request_id, success: false, error: 'Not authorized for this demand' });
        continue;
      }
      const check = checkDemandStatusTransition(demand.status, to_status, remark);
      if (!check.allowed) {
        results.push({ demand_id: demandId, request_id: demand.request_id, success: false, error: check.reason || 'Transition not allowed' });
        continue;
      }

      await prisma.$transaction([
        prisma.demands.update({ where: { id: demand.id }, data: { status: to_status, updated_by: currentUser.userId } }),
        prisma.demand_status_events.create({
          data: { demand_id: demand.id, from_status: demand.status, to_status, remark: remark || null, created_by: currentUser.userId },
        }),
      ]);
      results.push({ demand_id: demandId, request_id: demand.request_id, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ success: successCount > 0, successCount, failureCount: results.length - successCount, results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/demands/bulk-status:', error);
    return NextResponse.json({ error: 'Failed to bulk-update demand status' }, { status: 500 });
  }
}
