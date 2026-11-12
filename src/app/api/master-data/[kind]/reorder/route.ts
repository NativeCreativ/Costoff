import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { isNamedMasterKind, reorderNamedMaster } from '@/lib/masters/namedMasters';
import { namedMasterReorderSchema } from '@/components/masterData/namedMaster.schema';

export async function PUT(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { kind } = await params;
    if (!isNamedMasterKind(kind)) {
      return NextResponse.json({ error: 'Unknown master' }, { status: 404 });
    }
    const parsed = namedMasterReorderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await reorderNamedMaster(kind, parsed.data.orderedIds);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ items: result.items, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/master-data/[kind]/reorder:', error);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
