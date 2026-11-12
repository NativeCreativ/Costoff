import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { createNamedMaster, isNamedMasterKind, listNamedMaster } from '@/lib/masters/namedMasters';
import { namedMasterSchema } from '@/components/masterData/namedMaster.schema';

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await requireAuth();
    const { kind } = await params;
    if (!isNamedMasterKind(kind)) {
      return NextResponse.json({ error: 'Unknown master' }, { status: 404 });
    }
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
    if (includeInactive && !canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const items = await listNamedMaster(kind, includeInactive);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/master-data/[kind]:', error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { kind } = await params;
    if (!isNamedMasterKind(kind)) {
      return NextResponse.json({ error: 'Unknown master' }, { status: 404 });
    }
    const parsed = namedMasterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await createNamedMaster(kind, parsed.data.name);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ item: result.item, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/master-data/[kind]:', error);
    return NextResponse.json({ error: 'Failed to create master row' }, { status: 500 });
  }
}
