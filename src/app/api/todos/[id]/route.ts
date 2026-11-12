import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageTodo } from '@/lib/auth/teamWorkPermissions';
import { todoQuickUpdateSchema, todoSchema } from '@/components/teamWork/teamWork.schema';
import { serializeTodo, TODO_INCLUDE, toDbDate } from '@/lib/teamWork/serialize';

/**
 * Loads an item the caller may manage (its author, or Super Admin). Anything else — including a
 * published item someone else wrote — answers 404 for writes, so it cannot be changed by id.
 */
async function loadManageable(id: string, actor: { role: string; userId: string }) {
  const row = await prisma.todo_items.findUnique({ where: { id }, select: { id: true, created_by: true, is_published: true, published_at: true } });
  if (!row || !canManageTodo({ role: actor.role, id: actor.userId }, row)) return null;
  return row;
}

/** PUT /api/todos/[id] — full edit by the author / Super Admin. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    const existing = await loadManageable(id, currentUser);
    if (!existing) return NextResponse.json({ error: 'To-Do item not found' }, { status: 404 });

    const parsed = todoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const row = await prisma.todo_items.update({
      where: { id },
      data: {
        title: v.title,
        details: v.details || null,
        priority: v.priority,
        active_from: toDbDate(v.active_from),
        active_until: toDbDate(v.active_until),
        is_published: v.is_published,
        // First publish is stamped once; unpublishing back to draft clears it.
        published_at: v.is_published ? existing.published_at ?? new Date() : null,
      },
      include: TODO_INCLUDE,
    });
    return NextResponse.json({ todo: serializeTodo(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/todos/[id]:', error);
    return NextResponse.json({ error: 'Failed to update the To-Do item' }, { status: 500 });
  }
}

/** PATCH /api/todos/[id] — quick actions: mark done / reopen, publish / unpublish. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    const existing = await loadManageable(id, currentUser);
    if (!existing) return NextResponse.json({ error: 'To-Do item not found' }, { status: 404 });

    const parsed = todoQuickUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { status, is_published: isPublished } = parsed.data;
    const row = await prisma.todo_items.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(isPublished !== undefined
          ? { is_published: isPublished, published_at: isPublished ? existing.published_at ?? new Date() : null }
          : {}),
      },
      include: TODO_INCLUDE,
    });
    return NextResponse.json({ todo: serializeTodo(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/todos/[id]:', error);
    return NextResponse.json({ error: 'Failed to update the To-Do item' }, { status: 500 });
  }
}

/** DELETE /api/todos/[id] — author / Super Admin. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    if (!(await loadManageable(id, currentUser))) return NextResponse.json({ error: 'To-Do item not found' }, { status: 404 });
    await prisma.todo_items.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/todos/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete the To-Do item' }, { status: 500 });
  }
}
