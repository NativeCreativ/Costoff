import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageTaskLog } from '@/lib/auth/teamWorkPermissions';
import { taskLogSchema } from '@/components/teamWork/teamWork.schema';
import { serializeTaskLog, TASK_LOG_INCLUDE, toDbDate } from '@/lib/teamWork/serialize';

/** Someone else's task answers 404 (not 403), so ids of other people's tasks are not confirmed. */
async function loadOwnTask(id: string, actor: { role: string; userId: string }) {
  const row = await prisma.task_logs.findUnique({ where: { id }, select: { id: true, user_id: true } });
  if (!row || !canManageTaskLog({ role: actor.role, id: actor.userId }, row)) return null;
  return row;
}

/** PUT /api/task-logs/[id] — edit your own task (Super Admin: any). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    if (!(await loadOwnTask(id, currentUser))) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const parsed = taskLogSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const v = parsed.data;
    const row = await prisma.task_logs.update({
      where: { id },
      data: {
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
    console.error('Error in PUT /api/task-logs/[id]:', error);
    return NextResponse.json({ error: 'Failed to update the task' }, { status: 500 });
  }
}

/** DELETE /api/task-logs/[id] — remove your own task (Super Admin: any). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;
    if (!(await loadOwnTask(id, currentUser))) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    await prisma.task_logs.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/task-logs/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete the task' }, { status: 500 });
  }
}
