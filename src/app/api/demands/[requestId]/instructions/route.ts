import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canManageDemandInstruction, canWriteDemandInstructions } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { demandInstructionSchema } from '@/components/demandFulfillment/callLog.schema';
import { serializeInstruction, INSTRUCTION_INCLUDE } from '@/lib/demandFulfillment/serializeInstruction';
import { toDbDate } from '@/lib/teamWork/serialize';

/**
 * GET /api/demands/[requestId]/instructions — the demand's Instruction Log, latest first.
 * Everyone who can view the demand reads it; `can_add` / `can_manage` are UI hints, the writes
 * re-check.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canViewDemand(actor, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }
    const rows = await prisma.demand_instructions.findMany({
      where: { demand_id: demand.id },
      orderBy: [{ instruction_date: 'desc' }, { created_at: 'desc' }],
      include: INSTRUCTION_INCLUDE,
    });
    return NextResponse.json({
      instructions: rows.map((row) => ({ ...serializeInstruction(row), can_manage: canManageDemandInstruction(actor, demand, row) })),
      can_add: canWriteDemandInstructions(actor, demand),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/instructions:', error);
    return NextResponse.json({ error: 'Failed to load the instruction log' }, { status: 500 });
  }
}

/** POST — Super Admin, the demand's AM or its assigned SPOC (canWriteDemandInstructions). */
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    if (!canWriteDemandInstructions({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: "Only the demand's AM, its SPOC or the Delivery Head can add instructions" }, { status: 403 });
    }
    const parsed = demandInstructionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const row = await prisma.demand_instructions.create({
      data: {
        demand_id: demand.id,
        source: v.source,
        instruction_date: toDbDate(v.instruction_date),
        content: v.content,
        created_by: currentUser.userId,
      },
      include: INSTRUCTION_INCLUDE,
    });
    return NextResponse.json({ instruction: serializeInstruction(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/[requestId]/instructions:', error);
    return NextResponse.json({ error: 'Failed to save the instruction' }, { status: 500 });
  }
}
