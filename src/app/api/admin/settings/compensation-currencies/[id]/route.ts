import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { compensationCurrencySchema } from '@/components/settings/compensationMaster.schema';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { id } = await params;
    const body = await request.json();
    const parsed = compensationCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.compensation_currencies.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Currency not found' }, { status: 404 });
    }

    const codeOwner = await prisma.compensation_currencies.findFirst({
      where: { code: { equals: parsed.data.code, mode: 'insensitive' } },
    });
    if (codeOwner && codeOwner.id !== id) {
      return NextResponse.json({ error: `Currency code "${parsed.data.code}" already exists` }, { status: 409 });
    }
    const nameOwner = await prisma.compensation_currencies.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (nameOwner && nameOwner.id !== id) {
      return NextResponse.json({ error: `A currency named "${parsed.data.name}" already exists` }, { status: 409 });
    }

    const usageCount = await prisma.demands.count({ where: { compensation_currency_id: id } });
    const changedNameOrCode =
      (parsed.data.name !== undefined && parsed.data.name !== existing.name) ||
      (parsed.data.code !== undefined && parsed.data.code !== existing.code) ||
      (parsed.data.symbol !== undefined && parsed.data.symbol !== existing.symbol);
    if (usageCount > 0 && changedNameOrCode) {
      return NextResponse.json(
        { error: `"${existing.name}" is in use (${usageCount} demands) and cannot be edited or deleted.` },
        { status: 409 }
      );
    }

    const currency = await prisma.compensation_currencies.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ currency, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/compensation-currencies/[id]:', error);
    return NextResponse.json({ error: 'Failed to update currency' }, { status: 500 });
  }
}

// DELETE — hard delete, but only when no Demand references this currency (referential
// integrity enforced here, not just in the UI): a currency "in use" is blocked with a
// clear message instead of silently cascading into (or orphaning) existing Demand rows.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { id } = await params;

    const existing = await prisma.compensation_currencies.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Currency not found' }, { status: 404 });
    }

    const usageCount = await prisma.demands.count({ where: { compensation_currency_id: id } });
    if (usageCount > 0) {
      return NextResponse.json(
        { error: `"${existing.name}" is in use (${usageCount} demands) and cannot be edited or deleted.` },
        { status: 409 }
      );
    }

    await prisma.compensation_currencies.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/admin/settings/compensation-currencies/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete currency' }, { status: 500 });
  }
}
