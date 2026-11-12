import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { isNamedMasterKind, toggleNamedMaster } from '@/lib/masters/namedMasters';
import { namedMasterToggleSchema } from '@/components/masterData/namedMaster.schema';

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
    const parsed = namedMasterToggleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await toggleNamedMaster(kind, id, parsed.data.is_active);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ item: result.item, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/master-data/[kind]/[id]/toggle:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
