import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { SUPER_ADMIN_SETTINGS_KEYS, normalizeBgvChecklist } from '@/lib/demandFulfillment/constants';

// PUT /api/admin/settings/demand-fulfillment/bgv-checklist/[name]/toggle — Super Admin only.
// Toggles the isActive flag for one item in the bgv_checklist JSON list.
// BGV has no runtime consumer, so this is inert — usage is always 0.
export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireRole(['super_admin']);
    const { name } = await params;
    const body = await request.json();
    const isActive = Boolean(body?.is_active);

    const existing = await prisma.super_admin_settings.findUnique({
      where: { key: SUPER_ADMIN_SETTINGS_KEYS.bgvChecklist },
    });
    const items = normalizeBgvChecklist(existing?.value ?? []);
    const target = items.find((i) => i.name === name);
    if (!target) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    const next = items.map((i) => (i.name === name ? { ...i, isActive } : i));
    await prisma.super_admin_settings.upsert({
      where: { key: SUPER_ADMIN_SETTINGS_KEYS.bgvChecklist },
      update: { value: next as any },
      create: { key: SUPER_ADMIN_SETTINGS_KEYS.bgvChecklist, value: next as any },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT .../bgv-checklist/[name]/toggle:', error);
    return NextResponse.json({ error: 'Failed to toggle checklist item' }, { status: 500 });
  }
}
