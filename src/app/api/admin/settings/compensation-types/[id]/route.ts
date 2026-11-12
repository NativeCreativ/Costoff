import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { compensationTypeSchema } from '@/components/settings/compensationMaster.schema';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { id } = await params;
    const body = await request.json();
    const parsed = compensationTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.compensation_types.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compensation type not found' }, { status: 404 });
    }

    const nameOwner = await prisma.compensation_types.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
    });
    if (nameOwner && nameOwner.id !== id) {
      return NextResponse.json({ error: `Compensation type "${parsed.data.name}" already exists` }, { status: 409 });
    }

    const usageCount = await prisma.demands.count({ where: { compensation_type_id: id } });
    if (usageCount > 0 && parsed.data.name !== existing.name) {
      return NextResponse.json(
        { error: `"${existing.name}" is in use (${usageCount} demands) and cannot be edited or deleted.` },
        { status: 409 }
      );
    }

    const type = await prisma.compensation_types.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ type, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/compensation-types/[id]:', error);
    return NextResponse.json({ error: 'Failed to update compensation type' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { id } = await params;

    const existing = await prisma.compensation_types.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Compensation type not found' }, { status: 404 });
    }

    const usageCount = await prisma.demands.count({ where: { compensation_type_id: id } });
    if (usageCount > 0) {
      return NextResponse.json(
        { error: `"${existing.name}" is in use (${usageCount} demands) and cannot be edited or deleted.` },
        { status: 409 }
      );
    }

    await prisma.compensation_types.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/admin/settings/compensation-types/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete compensation type' }, { status: 500 });
  }
}
