import { NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canCreateTodo } from '@/lib/auth/teamWorkPermissions';
import { todoSchema, todayInIndia, TODO_VIEW_VALUES, type TodoView } from '@/components/teamWork/teamWork.schema';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';
import { serializeTodo, TODO_INCLUDE, toDbDate } from '@/lib/teamWork/serialize';

/** High first, then Medium, then Low — applied after the DB sort below. */
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/**
 * GET /api/todos?view=active|upcoming|past|mine&page=&pageSize=
 *   active   (default) published items whose period includes today (India time) — everyone
 *   upcoming published items starting later
 *   past     published items whose period has ended
 *   mine     the caller's own items, drafts included (authors only)
 * Open items come before done ones, then High → Low priority.
 */
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawView = searchParams.get('view') || 'active';
    const view: TodoView = (TODO_VIEW_VALUES as readonly string[]).includes(rawView) ? (rawView as TodoView) : 'active';
    const { page, pageSize, skip, take } = parsePagination(searchParams.get(PAGE_PARAM), searchParams.get(PAGE_SIZE_PARAM));
    const today = toDbDate(todayInIndia());

    const where: Prisma.todo_itemsWhereInput =
      view === 'mine'
        ? { created_by: currentUser.userId }
        : view === 'upcoming'
          ? { is_published: true, active_from: { gt: today } }
          : view === 'past'
            ? { is_published: true, active_until: { lt: today } }
            : { is_published: true, active_from: { lte: today }, active_until: { gte: today } };

    const [rows, total] = await Promise.all([
      prisma.todo_items.findMany({
        where,
        orderBy: [{ status: 'desc' }, { active_until: view === 'past' ? 'desc' : 'asc' }, { created_at: 'desc' }],
        skip,
        take,
        include: TODO_INCLUDE,
      }),
      prisma.todo_items.count({ where }),
    ]);
    // status 'open' > 'done' alphabetically, so desc puts open first; then rank by priority
    // within each status, keeping the date order for equal priority.
    const todos = rows
      .map(serializeTodo)
      .sort((a, b) => (a.status === b.status ? (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) : 0));
    return NextResponse.json({ todos, ...buildPaginationMeta(total, page, pageSize), can_create: canCreateTodo(currentUser.role), today: todayInIndia() });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/todos:', error);
    return NextResponse.json({ todos: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

/** POST /api/todos — Super Admin, Account Managers and SPOCs (canCreateTodo). */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canCreateTodo(currentUser.role)) {
      return NextResponse.json({ error: 'Only Account Managers, SPOCs and the Delivery Head can add To-Do items' }, { status: 403 });
    }
    const parsed = todoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const row = await prisma.todo_items.create({
      data: {
        title: v.title,
        details: v.details || null,
        priority: v.priority,
        active_from: toDbDate(v.active_from),
        active_until: toDbDate(v.active_until),
        is_published: v.is_published,
        published_at: v.is_published ? new Date() : null,
        created_by: currentUser.userId,
      },
      include: TODO_INCLUDE,
    });
    return NextResponse.json({ todo: serializeTodo(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/todos:', error);
    return NextResponse.json({ error: 'Failed to save the To-Do item' }, { status: 500 });
  }
}
