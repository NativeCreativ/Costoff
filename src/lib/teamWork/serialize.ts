/** A YYYY-MM-DD string as the UTC-midnight Date Prisma writes to a @db.Date column. */
export function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** A @db.Date value back to YYYY-MM-DD. */
export function fromDbDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export const TASK_LOG_INCLUDE = { profiles: { select: { full_name: true, role: true } } } as const;
export const TODO_INCLUDE = { profiles: { select: { full_name: true, role: true } } } as const;

export function serializeTaskLog(row: {
  id: string;
  user_id: string;
  task_name: string;
  details: string | null;
  start_date: Date;
  end_date: Date | null;
  remarks: string | null;
  assigned_by: string | null;
  hours: { toString(): string } | null;
  created_at: Date;
  updated_at: Date;
  profiles: { full_name: string; role: string } | null;
}) {
  return {
    id: row.id,
    user_id: row.user_id,
    assigned_by: row.assigned_by,
    hours: row.hours == null ? null : Number(row.hours.toString()),
    user_name: row.profiles?.full_name ?? null,
    task_name: row.task_name,
    details: row.details,
    start_date: fromDbDate(row.start_date)!,
    end_date: fromDbDate(row.end_date),
    remarks: row.remarks,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function serializeTodo(row: {
  id: string;
  title: string;
  details: string | null;
  priority: string;
  active_from: Date;
  active_until: Date;
  status: string;
  is_published: boolean;
  published_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  profiles: { full_name: string; role: string } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    priority: row.priority,
    active_from: fromDbDate(row.active_from)!,
    active_until: fromDbDate(row.active_until)!,
    status: row.status,
    is_published: row.is_published,
    published_at: row.published_at?.toISOString() ?? null,
    created_by: row.created_by,
    created_by_name: row.profiles?.full_name ?? null,
    created_by_role: row.profiles?.role ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
