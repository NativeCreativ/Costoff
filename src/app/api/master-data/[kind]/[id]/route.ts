import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { deleteNamedMaster, isNamedMasterKind, updateNamedMaster } from '@/lib/masters/namedMasters';
import { namedMasterSchema } from '@/components/masterData/namedMaster.schema';

export async function PUT(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { kind, id } = await params;
    if (!isNamedMasterKind(kind)) {
      return NextResponse.json({ error: 'Unknown master' }, { status: 404 });
    }
    const parsed = namedMasterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await updateNamedMaster(kind, id, parsed.data.name);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ item: result.item, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/master-data/[kind]/[id]:', error);
    return NextResponse.json({ error: 'Failed to update master row' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { kind, id } = await params;
    if (!isNamedMasterKind(kind)) {
      return NextResponse.json({ error: 'Unknown master' }, { status: 404 });
    }
    const result = await deleteNamedMaster(kind, id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/master-data/[kind]/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete master row' }, { status: 500 });
  }
}
