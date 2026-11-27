import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import { userSchema, userCreateSchema } from '@/components/users/user.schema';
import { hashPassword } from '@/lib/auth/password';
import { USER_SEARCH_FIELDS } from '@/constants/search';
import { USER_FILTER_FIELDS } from '@/constants/filters';
import { buildSearchWhere } from '@/lib/search';
import { buildExactMatchWhere } from '@/lib/filter';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';

function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const { page, pageSize, skip, take } = parsePagination(
      searchParams.get(PAGE_PARAM),
      searchParams.get(PAGE_SIZE_PARAM)
    );

    const where: Prisma.profilesWhereInput = {
      ...buildExactMatchWhere<Prisma.profilesWhereInput>({
        [USER_FILTER_FIELDS.role]: role,
        [USER_FILTER_FIELDS.status]: status,
      }),
    };
    const searchOr = buildSearchWhere<Prisma.profilesWhereInput>(search, USER_SEARCH_FIELDS);
    if (searchOr) where.OR = searchOr;

    const [profiles, total] = await prisma.$transaction([
      prisma.profiles.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.profiles.count({ where }),
    ]);

    const safeProfiles = profiles.map(({ password_hash: _omit, ...rest }) => rest);

    return NextResponse.json({
      profiles: safeProfiles,
      ...buildPaginationMeta(total, page, pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/users:', error);
    return NextResponse.json({ profiles: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(['super_admin']);
    const body = await request.json();

    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    const newProfile = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      full_name: buildFullName(values.first_name, values.last_name),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      date_of_joining: values.date_of_joining ? new Date(values.date_of_joining) : null,
      role: values.role,
      status: values.status,
      is_active: values.status === 'ACTIVE',
      password_hash: await hashPassword(values.password as string),
    };

    let profile;
    try {
      profile = await prisma.profiles.create({ data: newProfile });
    } catch (dbError) {
      console.error('Error creating profile:', dbError);
      const message = dbError instanceof Error && dbError.message.includes('Unique constraint')
        ? 'A user with this email already exists'
        : 'Failed to create user profile';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { password_hash: _omit, ...safeProfile } = profile;
    return NextResponse.json({ profile: safeProfile, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/users:', error);
    return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requireAuth();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const isSelf = id === currentUser.userId;
    const isSuperAdmin = currentUser.role === 'super_admin';

    // Editing another user's profile is super_admin-only. Editing your own
    // profile is always allowed, but only super_admin may change role/status
    // (their own or anyone else's) — a non-admin can't self-promote.
    if (!isSelf && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    // Self-edit by a non-admin is limited to name/email/phone. Role, status,
    // and date_of_joining stay super_admin-only (own profile or anyone else's).
    const updateData: Record<string, unknown> = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      full_name: buildFullName(values.first_name, values.last_name),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
    };

    if (isSuperAdmin) {
      updateData.date_of_joining = values.date_of_joining ? new Date(values.date_of_joining) : null;
      updateData.role = values.role;
      updateData.status = values.status;
      updateData.is_active = values.status === 'ACTIVE';
    }

    let profile;
    try {
      profile = await prisma.profiles.update({ where: { id }, data: updateData });
    } catch (dbError) {
      console.error('Error updating profile:', dbError);
      const message = dbError instanceof Error && dbError.message.includes('Unique constraint')
        ? 'A user with this email already exists'
        : 'Failed to update user profile';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { password_hash: _omit, ...safeProfile } = profile;
    return NextResponse.json({ profile: safeProfile, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/users:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await requireRole(['super_admin']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (id === currentUser.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    try {
      await prisma.profiles.delete({ where: { id } });
    } catch (dbError) {
      console.error('Error deleting profile:', dbError);
      return NextResponse.json({ error: dbError instanceof Error ? dbError.message : 'Failed to delete user profile' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/users:', error);
    return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 });
  }
}
