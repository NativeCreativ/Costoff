import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageMasterData } from '@/lib/auth/masterDataPermissions';
import { endClientSchema } from '@/components/masterData/endClient.schema';
import { replaceEndClientSpocs } from '@/lib/companies/companySpocs';
import { buildSearchWhere } from '@/lib/search';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';
import { COMPANY_STATUS_VALUES } from '@/components/companies/company.schema';

const SEARCH_FIELDS = ['name', 'location', 'description'] as const;

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const activeOnly = searchParams.get('active') === 'true';
    const { page, pageSize, skip, take } = parsePagination(searchParams.get(PAGE_PARAM), searchParams.get(PAGE_SIZE_PARAM));

    const where: Prisma.end_clientsWhereInput = {};
    if (activeOnly) where.status = 'ACTIVE';
    else if (status && (COMPANY_STATUS_VALUES as readonly string[]).includes(status)) where.status = status;
    const searchOr = buildSearchWhere<Prisma.end_clientsWhereInput>(search, SEARCH_FIELDS);
    if (searchOr) where.OR = searchOr;

    const [rows, total] = await prisma.$transaction([
      prisma.end_clients.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: activeOnly ? undefined : skip,
        take: activeOnly ? undefined : take,
        include: {
          end_client_spocs: { orderBy: { sort_order: 'asc' } },
          _count: { select: { demands: true } },
        },
      }),
      prisma.end_clients.count({ where }),
    ]);

    return NextResponse.json({
      endClients: rows,
      ...buildPaginationMeta(total, activeOnly ? 1 : page, activeOnly ? Math.max(total, 1) : pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/end-clients:', error);
    return NextResponse.json({ endClients: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageMasterData(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const parsed = endClientSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, location, description, status, spocs } = parsed.data;
    const existing = await prisma.end_clients.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json({ error: `An end client named "${existing.name}" already exists` }, { status: 409 });
    }

    const endClient = await prisma.$transaction(async (tx) => {
      const created = await tx.end_clients.create({
        data: {
          name: name.trim(),
          location: location?.trim() || null,
          description: description?.trim() || null,
          status: status ?? 'ACTIVE',
          created_by: user.userId,
          updated_by: user.userId,
        },
      });
      if (spocs) await replaceEndClientSpocs(created.id, spocs, tx);
      return tx.end_clients.findUnique({
        where: { id: created.id },
        include: { end_client_spocs: { orderBy: { sort_order: 'asc' } } },
      });
    });
    return NextResponse.json({ endClient, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/end-clients:', error);
    return NextResponse.json({ error: 'Failed to create end client' }, { status: 500 });
  }
}
