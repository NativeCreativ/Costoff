import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { endClientSchema } from '@/components/masterData/endClient.schema';
import { replaceEndClientSpocs } from '@/lib/companies/companySpocs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const endClient = await prisma.end_clients.findUnique({
      where: { id },
      include: {
        end_client_spocs: { orderBy: { sort_order: 'asc' } },
        _count: { select: { demands: true } },
      },
    });
    if (!endClient) return NextResponse.json({ error: 'End client not found' }, { status: 404 });
    return NextResponse.json({ endClient });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/end-clients/[id]:', error);
    return NextResponse.json({ error: 'Failed to load end client' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.end_clients.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'End client not found' }, { status: 404 });

    const body = await request.json();
    const spocsSent = Object.prototype.hasOwnProperty.call(body ?? {}, 'spocs');
    const parsed = endClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, location, description, status, spocs } = parsed.data;
    const owner = await prisma.end_clients.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (owner && owner.id !== id) {
      return NextResponse.json({ error: `An end client named "${owner.name}" already exists` }, { status: 409 });
    }

    const endClient = await prisma.$transaction(async (tx) => {
      await tx.end_clients.update({
        where: { id },
        data: {
          name: name.trim(),
          location: location?.trim() || null,
          description: description?.trim() || null,
          status: status ?? 'ACTIVE',
          updated_by: user.userId,
        },
      });
      if (spocsSent && spocs) await replaceEndClientSpocs(id, spocs, tx);
      return tx.end_clients.findUnique({
        where: { id },
        include: { end_client_spocs: { orderBy: { sort_order: 'asc' } } },
      });
    });
    return NextResponse.json({ endClient, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/end-clients/[id]:', error);
    return NextResponse.json({ error: 'Failed to update end client' }, { status: 500 });
  }
}
