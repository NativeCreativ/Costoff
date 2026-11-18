import { z } from 'zod';

export const TODO_PRIORITY_VALUES = ['High', 'Medium', 'Low'] as const;
export const TODO_STATUS_VALUES = ['open', 'done'] as const;
/** To-Do list views: active today, starting later, finished period, or my own (incl. drafts). */
export const TODO_VIEW_VALUES = ['active', 'upcoming', 'past', 'mine'] as const;
export type TodoView = (typeof TODO_VIEW_VALUES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateField = (message: string) => z.string().regex(ISO_DATE, message);
const optionalDate = z.string().refine((v) => v === '' || ISO_DATE.test(v), 'Enter a valid date');

/** Today's date in India (the team's working day), as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/* ─────────────── Task Log ─────────────── */

export const taskLogSchema = z
  .object({
    task_name: z.string().trim().min(1, 'Task name is required').max(200, 'Keep the task name to 200 characters or fewer'),
    details: z.string().trim().max(5000, 'Keep details to 5000 characters or fewer'),
    start_date: dateField('Start date is required'),
    /** '' = still ongoing. */
    end_date: optionalDate,
    remarks: z.string().trim().max(2000, 'Keep remarks to 2000 characters or fewer'),
    /** Free text: who asked for the task. */
    assigned_by: z.string().trim().max(200, 'Keep this to 200 characters or fewer'),
    /** '' = not given. Up to 9999 hours, two decimals (e.g. 1.5). */
    hours: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{1,4}(\.\d{1,2})?$/.test(v), 'Enter hours as a number, e.g. 2 or 1.5'),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { path: ['end_date'], message: 'End date cannot be before the start date' });
export type TaskLogValues = z.infer<typeof taskLogSchema>;

/* ─────────────── To-Do ─────────────── */

export const todoSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Keep the title to 200 characters or fewer'),
    details: z.string().trim().max(5000, 'Keep details to 5000 characters or fewer'),
    priority: z.enum(TODO_PRIORITY_VALUES, { message: 'Select a priority' }),
    active_from: dateField('Active from is required'),
    active_until: dateField('Active until is required'),
    /** false = draft (author only); true = everyone sees it while active. */
    is_published: z.boolean(),
  })
  .refine((v) => v.active_until >= v.active_from, { path: ['active_until'], message: '"Active until" cannot be before "Active from"' });
export type TodoValues = z.infer<typeof todoSchema>;

/** PATCH /api/todos/[id] — quick actions (complete / reopen, publish / unpublish). */
export const todoQuickUpdateSchema = z.object({
  status: z.enum(TODO_STATUS_VALUES).optional(),
  is_published: z.boolean().optional(),
});

/** Where an item sits relative to today. */
export function todoTiming(item: { active_from: string; active_until: string }, today: string = todayInIndia()): 'upcoming' | 'active' | 'past' {
  const from = item.active_from.slice(0, 10);
  const until = item.active_until.slice(0, 10);
  if (today < from) return 'upcoming';
  if (today > until) return 'past';
  return 'active';
}
