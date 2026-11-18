import { NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewAllTaskLogs } from '@/lib/auth/teamWorkPermissions';
import { taskLogSchema } from '@/components/teamWork/teamWork.schema';
import { buildSearchWhere } from '@/lib/search';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';
import { serializeTaskLog, TASK_LOG_INCLUDE, toDbDate } from '@/lib/teamWork/serialize';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/task-logs?from=&to=&userId=&search=&page=&pageSize= — newest first.
 * Everyone gets their own tasks; Super Admin gets everyone's and may filter by `userId`.
 * `from` / `to` match tasks whose period overlaps the range (an ongoing task has no end).
 */
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = parsePagination(searchParams.get(PAGE_PARAM), searchParams.get(PAGE_SIZE_PARAM));
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const userId = searchParams.get('userId') || '';
    const seeAll = canViewAllTaskLogs(currentUser.role);

    const and: Prisma.task_logsWhereInput[] = [];
    if (!seeAll) and.push({ user_id: currentUser.userId });
    else if (userId && UUID_RE.test(userId)) and.push({ user_id: userId });
    if (ISO_DATE.test(to)) and.push({ start_date: { lte: toDbDate(to) } });
    if (ISO_DATE.test(from)) and.push({ OR: [{ end_date: null }, { end_date: { gte: toDbDate(from) } }] });
    const searchOr = buildSearchWhere<Prisma.task_logsWhereInput>(searchParams.get('search'), ['task_name', 'details', 'remarks', 'assigned_by']);
    if (searchOr) and.push({ OR: searchOr });
    const where: Prisma.task_logsWhereInput = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      prisma.task_logs.findMany({ where, orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }], skip, take, include: TASK_LOG_INCLUDE }),
      prisma.task_logs.count({ where }),
    ]);
    return NextResponse.json({ taskLogs: rows.map(serializeTaskLog), ...buildPaginationMeta(total, page, pageSize), can_view_all: seeAll });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/task-logs:', error);
    return NextResponse.json({ taskLogs: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

/** POST /api/task-logs — log a task for yourself. Any signed-in user. */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    const parsed = taskLogSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const row = await prisma.task_logs.create({
      data: {
        user_id: currentUser.userId,
        task_name: v.task_name,
        details: v.details || null,
        start_date: toDbDate(v.start_date),
        end_date: v.end_date ? toDbDate(v.end_date) : null,
        remarks: v.remarks || null,
        assigned_by: v.assigned_by || null,
        hours: v.hours === '' ? null : v.hours,
      },
      include: TASK_LOG_INCLUDE,
    });
    return NextResponse.json({ taskLog: serializeTaskLog(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/task-logs:', error);
    return NextResponse.json({ error: 'Failed to save the task' }, { status: 500 });
  }
}
