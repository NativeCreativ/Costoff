import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageCompanySpocsFromDemand } from '@/lib/auth/companyPermissions';
import { clientSpocItemSchema } from '@/components/masterData/spoc.schema';

const SPOC_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  designation: true,
  vertical: true,
  supervisor: true,
  supervisor_designation: true,
  is_active: true,
} as const;

async function loadCompanyForActor(id: string, actor: { role: string; userId: string }) {
  const company = await prisma.companies.findUnique({ where: { id }, select: { id: true, account_manager_id: true } });
  // Not found and not yours answer the same 404, so ids of other AMs' clients are not confirmed.
  if (!company || !canManageCompanySpocsFromDemand(actor.role, actor.userId, company.account_manager_id)) return null;
  return company;
}

/**
 * GET /api/companies/[id]/spocs — the client's SPOCs for the demand form's SPOC picker.
 * Returns inactive ones too (flagged), so a demand can still show a SPOC it already uses.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    const company = await loadCompanyForActor(id, currentUser);
    if (!company) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const spocs = await prisma.company_spocs.findMany({
      where: { company_id: id },
      orderBy: { sort_order: 'asc' },
      select: SPOC_SELECT,
    });
    return NextResponse.json({ spocs });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/companies/[id]/spocs:', error);
    return NextResponse.json({ error: 'Failed to load client SPOCs' }, { status: 500 });
  }
}

/** POST /api/companies/[id]/spocs — "Add SPOC" from the demand form. Appends one active SPOC. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    const company = await loadCompanyForActor(id, currentUser);
    if (!company) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const parsed = clientSpocItemSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const item = parsed.data;
    const name = item.name.trim();

    const duplicate = await prisma.company_spocs.findFirst({
      where: { company_id: id, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: `"${name}" is already a SPOC for this client`, code: 'DUPLICATE_SPOC' }, { status: 409 });
    }

    const last = await prisma.company_spocs.findFirst({
      where: { company_id: id },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    const spoc = await prisma.company_spocs.create({
      data: {
        company_id: id,
        name,
        email: item.email?.trim() || null,
        phone: item.phone?.trim() || null,
        designation: item.designation?.trim() || null,
        vertical: item.vertical?.trim() || null,
        supervisor: item.supervisor?.trim() || null,
        supervisor_designation: item.supervisor_designation?.trim() || null,
        is_active: true,
        sort_order: (last?.sort_order ?? -1) + 1,
      },
      select: SPOC_SELECT,
    });
    return NextResponse.json({ spoc, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/companies/[id]/spocs:', error);
    return NextResponse.json({ error: 'Failed to add the client SPOC' }, { status: 500 });
  }
}
