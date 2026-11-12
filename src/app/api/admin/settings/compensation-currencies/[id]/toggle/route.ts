import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { id } = await params;
    const body = await request.json();
    const isActive = Boolean(body?.is_active);

    const existing = await prisma.compensation_currencies.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Currency not found' }, { status: 404 });
    }

    const currency = await prisma.compensation_currencies.update({
      where: { id },
      data: { is_active: isActive },
    });
    return NextResponse.json({ currency, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT .../toggle:', error);
    return NextResponse.json({ error: 'Failed to toggle currency' }, { status: 500 });
  }
}