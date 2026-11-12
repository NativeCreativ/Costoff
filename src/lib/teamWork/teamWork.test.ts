import { describe, expect, it } from 'vitest';
import { taskLogSchema, todoSchema, todoTiming, todayInIndia } from '@/components/teamWork/teamWork.schema';
import { canCreateTodo, canManageTaskLog, canManageTodo, canSeeTodo, canViewAllTaskLogs } from '@/lib/auth/teamWorkPermissions';
import { fromDbDate, toDbDate } from './serialize';

describe('task log schema', () => {
  const base = { task_name: 'Screened profiles', details: '', start_date: '2026-11-13', end_date: '', remarks: '' };
  it('accepts an ongoing task and a one-day task', () => {
    expect(taskLogSchema.safeParse(base).success).toBe(true);
    expect(taskLogSchema.safeParse({ ...base, end_date: '2026-11-13' }).success).toBe(true);
  });
  it('rejects an end date before the start and a missing name', () => {
    expect(taskLogSchema.safeParse({ ...base, end_date: '2026-11-12' }).success).toBe(false);
    expect(taskLogSchema.safeParse({ ...base, task_name: ' ' }).success).toBe(false);
  });
});

describe('to-do schema and timing', () => {
  const base = { title: 'Close Java roles', details: '', priority: 'High', active_from: '2026-11-13', active_until: '2026-11-20', is_published: true };
  it('needs until >= from and a known priority', () => {
    expect(todoSchema.safeParse(base).success).toBe(true);
    expect(todoSchema.safeParse({ ...base, active_until: '2026-11-12' }).success).toBe(false);
    expect(todoSchema.safeParse({ ...base, priority: 'Urgent' }).success).toBe(false);
  });
  it('places an item relative to today, inclusive on both ends', () => {
    expect(todoTiming(base, '2026-11-12')).toBe('upcoming');
    expect(todoTiming(base, '2026-11-13')).toBe('active');
    expect(todoTiming(base, '2026-11-20')).toBe('active');
    expect(todoTiming(base, '2026-11-21')).toBe('past');
  });
  it("uses India's date for today", () => {
    // 20:00 UTC on 12 Nov is 01:30 on 13 Nov in India.
    expect(todayInIndia(new Date('2026-11-12T20:00:00Z'))).toBe('2026-11-13');
  });
});

describe('date round-trip', () => {
  it('stores and reads a calendar date without shifting it', () => {
    expect(fromDbDate(toDbDate('2026-11-13'))).toBe('2026-11-13');
    expect(fromDbDate(null)).toBeNull();
  });
});

describe('team work permissions', () => {
  it('task log: own rows only, Delivery Head sees and manages all', () => {
    expect(canViewAllTaskLogs('super_admin')).toBe(true);
    expect(canViewAllTaskLogs('account_manager')).toBe(false);
    expect(canManageTaskLog({ role: 'ta', id: 'u1' }, { user_id: 'u1' })).toBe(true);
    expect(canManageTaskLog({ role: 'ta', id: 'u1' }, { user_id: 'u2' })).toBe(false);
    expect(canManageTaskLog({ role: 'super_admin', id: 'dh' }, { user_id: 'u2' })).toBe(true);
  });

  it('to-do: AM / SPOC / DH write; only the author (or DH) manages; drafts stay private', () => {
    expect(canCreateTodo('account_manager')).toBe(true);
    expect(canCreateTodo('spoc')).toBe(true);
    expect(canCreateTodo('ta')).toBe(false);
    expect(canManageTodo({ role: 'spoc', id: 's1' }, { created_by: 's1' })).toBe(true);
    expect(canManageTodo({ role: 'account_manager', id: 'a1' }, { created_by: 's1' })).toBe(false);
    expect(canManageTodo({ role: 'super_admin', id: 'dh' }, { created_by: 's1' })).toBe(true);
    expect(canSeeTodo({ role: 'ta', id: 't1' }, { created_by: 's1', is_published: true })).toBe(true);
    expect(canSeeTodo({ role: 'ta', id: 't1' }, { created_by: 's1', is_published: false })).toBe(false);
  });
});
