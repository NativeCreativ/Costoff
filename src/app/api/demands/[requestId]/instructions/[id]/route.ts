import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandInstruction } from '@/lib/auth/demandFulfillmentPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { demandInstructionSchema } from '@/components/demandFulfillment/callLog.schema';
import { serializeInstruction, INSTRUCTION_INCLUDE } from '@/lib/demandFulfillment/serializeInstruction';
import { toDbDate } from '@/lib/teamWork/serialize';

/** The instruction, checked to belong to this demand and to be manageable by the caller. */
async function loadManageable(requestId: string, id: string, actor: { role: string; userId: string }) {
  const demand = await loadDemandContext(requestId);
  if (!demand) return null;
  const row = await prisma.demand_instructions.findUnique({ where: { id }, select: { id: true, demand_id: true, created_by: true } });
  if (!row || row.demand_id !== demand.id) return null;
  if (!canManageDemandInstruction({ role: actor.role, id: actor.userId }, demand, row)) return null;
  return row;
}

/** PUT — edit an instruction (its author while still AM / SPOC on the demand, or Super Admin). */
export async function PUT(request: Request, { params }: { params: Promise<{ requestId: string; id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId, id } = await params;
    if (!(await loadManageable(requestId, id, currentUser))) return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    const parsed = demandInstructionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const row = await prisma.demand_instructions.update({
      where: { id },
      data: { source: v.source, instruction_date: toDbDate(v.instruction_date), content: v.content },
      include: INSTRUCTION_INCLUDE,
    });
    return NextResponse.json({ instruction: serializeInstruction(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/demands/[requestId]/instructions/[id]:', error);
    return NextResponse.json({ error: 'Failed to update the instruction' }, { status: 500 });
  }
}

/** DELETE — same rule as edit. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ requestId: string; id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId, id } = await params;
    if (!(await loadManageable(requestId, id, currentUser))) return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    await prisma.demand_instructions.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/demands/[requestId]/instructions/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete the instruction' }, { status: 500 });
  }
}
